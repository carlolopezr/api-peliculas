const { Router } = require('express');
const { uploadImageToServer } = require('../controllers/video');
const { uploadUserImageToCloudinary } = require('../controllers/user');
const router = Router();

router.put('/upload-profile-image', uploadImageToServer, uploadUserImageToCloudinary);

module.exports = router;
