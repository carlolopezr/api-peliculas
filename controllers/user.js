const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadUserImageToCloudinary = async (req = request, res = response) => {
	cloudinary.uploader.upload(
		req.filePath,
		{ public_id: `${req.userId}`, folder: `${req.userId}`, invalidate: true },
		(error, result) => {
			if (error) {
				return res.status(500).json({
					msg: 'Error al subir la imagen',
					error,
				});
			}
			fs.unlinkSync(req.filePath);
			return res.status(201).json({
				imageUrl: result.secure_url,
			});
		}
	);
};

module.exports = {
	uploadUserImageToCloudinary,
};
