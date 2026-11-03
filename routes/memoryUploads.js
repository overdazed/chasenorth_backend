const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect } = require('../middleware/authMiddleware');
const MemoryPrint = require('../models/MemoryPrint');

// Upload files to Memory-Prints bucket via backend (avoids RLS issues)
router.post('/', protect, async (req, res) => {
  try {
    const { userId, userEmail, albumPath, fileName, fileData, fileType } = req.body;

    if (!supabase) {
      return res.status(500).json({ 
        error: 'Supabase not configured' 
      });
    }

    if (!userId || !fileName || !fileData) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, fileName, fileData' 
      });
    }
    
    // Ensure the authenticated user matches the requested userId
    if (req.user && userId && req.user._id.toString() !== String(userId)) {
      return res.status(403).json({ error: 'Not authorized to upload for this user' });
    }

    // Use email as base folder (sanitized)
    const folderName = userEmail 
      ? userEmail.replace(/[^a-zA-Z0-9._-]/g, '_') 
      : userId;

    // Add album path if provided (for subfolders)
    const albumFolder = albumPath ? `/${albumPath}` : '';

    // Validate file size (50MB limit)
    const buffer = Buffer.from(fileData, 'base64');
    if (buffer.length > 52428800) { // 50MB
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 50MB.' 
      });
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg'
    ];
    
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ 
        error: 'Unsupported file type' 
      });
    }

    // Use album folder in path if provided
    const filePath = `${folderName}${albumFolder}/${Date.now()}_${fileName}`;

    // Upload using service role key (bypasses RLS)
    const { data, error } = await supabase.storage
      .from('Memory-Prints')
      .upload(filePath, buffer, {
        contentType: fileType,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Generate public URL
    const { data: publicUrlData } = supabase.storage
      .from('Memory-Prints')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      path: data.path,
      url: publicUrlData.publicUrl
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all files for a specific user by email
router.get('/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Sanitize email for use as folder path
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // List all files under this user's folder
    const { data, error } = await supabase.storage
      .from('Memory-Prints')
      .list(sanitizedEmail);

    if (error) throw error;

    // Generate public URLs for all files
    const filesWithUrls = data.map(file => {
      const filePath = `${sanitizedEmail}/${file.name}`;
      const { data: publicUrlData } = supabase.storage
        .from('Memory-Prints')
        .getPublicUrl(filePath);
      
      return {
        name: file.name,
        size: file.metadata?.size || 0,
        contentType: file.metadata?.contentType || 'unknown',
        url: publicUrlData.publicUrl,
        uploadedAt: new Date(file.created_at).toISOString()
      };
    });

    res.json({
      success: true,
      files: filesWithUrls
    });

  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's uploads for hash matching
router.post('/match', async (req, res) => {
  try {
    const { imageHash } = req.body;

    if (!imageHash) {
      return res.status(400).json({ success: false, message: 'Missing imageHash' });
    }

    const record = await MemoryPrint.findOne({ signatureHash: imageHash });

    if (!record) {
      return res.json({ success: false, message: 'No matching memory found' });
    }

    res.json({
      success: true,
      media: {
        url: record.mediaUrl || (record.fileUrls && record.fileUrls[0]),
        email: record.userEmail,
        files: record.fileUrls || [],
        albumPath: record.albumPath,
        createdAt: record.createdAt
      }
    });

  } catch (error) {
    console.error('Match error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save a memory print record (signature hash -> uploaded files)
router.post('/record', protect, async (req, res) => {
  try {
    const { signatureHash, fileUrls, albumPath, userEmail, userId } = req.body;

    if (!signatureHash) {
      return res.status(400).json({ success: false, message: 'Missing signatureHash' });
    }

    const record = await MemoryPrint.create({
      signatureHash,
      userId: userId || (req.user && req.user._id ? req.user._id.toString() : undefined),
      userEmail: userEmail || (req.user && req.user.email),
      albumPath,
      fileUrls: fileUrls || [],
      mediaUrl: (fileUrls && fileUrls[0]) || undefined
    });

    res.json({ success: true, record });
  } catch (error) {
    console.error('Record save error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;