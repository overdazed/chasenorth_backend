const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Upload files to Memory-Prints bucket via backend (avoids RLS issues)
router.post('/', async (req, res) => {
  try {
    const { userId, fileName, fileData, fileType } = req.body;

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

    const filePath = `${userId}/${Date.now()}_${fileName}`;

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

module.exports = router;