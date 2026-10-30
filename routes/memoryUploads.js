const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Upload files to Memory-Prints bucket via backend (avoids RLS issues)
router.post('/', async (req, res) => {
  try {
    const { userId, userEmail, fileName, fileData, fileType } = req.body;

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

    // Use email as folder name (sanitized) or fallback to userId
    const folderName = userEmail 
      ? userEmail.replace(/[^a-zA-Z0-9._-]/g, '_') 
      : userId;

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

    const filePath = `${folderName}/${Date.now()}_${fileName}`;

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
    const { imageHash, userId } = req.body;
    
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Query database for matching hash
    const { data: uploads, error } = await supabase
      .from('memory_prints')
      .select('media_url, signature_hash, user_email, created_at')
      .eq('signature_hash', imageHash)
      .single();

    if (error) {
      return res.json({ success: false, message: 'No matching memory found' });
    }

    res.json({
      success: true,
      media: {
        url: uploads.media_url,
        email: uploads.user_email,
        createdAt: uploads.created_at
      }
    });

  } catch (error) {
    console.error('Match error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;