const { Router } = require("express");

const { postVideoOnServer, postVideoOnCloudStorage, 
    uploadImageToServer, uploadImageToCloudinary,videoDetection, generateHLS } = require("../controllers/video");

const { fieldValidator } = require("../helpers/validator");
const { check } = require("express-validator");
const router = Router()

// MULTER
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const id = req.query.id 
//         const uploadDir = path.join(`./uploads/${id}`); 
//         if (!fs.existsSync(uploadDir)) {
//         fs.mkdirSync(uploadDir, { recursive: true });
//         }
//         cb(null, uploadDir);
//     },
    
//     filename: (req, file, cb) => {
//         cb(null, file.originalname)
//     },
//   });
  
//   const upload = multer({
//     storage:storage, 
//     limits: {
//         fileSize: 64516992768
//     },
//     fileFilter: (req, file, cb) => {
//         checkFileType(file, cb)
//     }
//   })


//RUTAS

router.get('/', (req, res) => {
    res.send('Hola mundo')
})

router.post('/',[
    check('id', 'Falta el id de usuario en la solicitud').not().isEmpty(),
    check('date', 'Falta el campo date en la solicitud').not().isEmpty(),
    fieldValidator,  
], postVideoOnServer, generateHLS, postVideoOnCloudStorage, videoDetection)

// router.post('/encode', encode)

// router.post('/upload-cloudstorage', postVideoOnCloudStorage)

// router.post('/video-detection', videoDetection)

router.post('/upload-image', uploadImageToServer, uploadImageToCloudinary);


// Middleware para manejar errores de multer
// router.use((err, req, res, next) => {
//     if (err instanceof multer.MulterError) {
//       return res.status(400).json({ error: 'Error en la carga del archivo: ' + err.message });
//     } else if (err) {
//       return res.status(400).json({ error: 'Error en la carga del archivo: ' + err.message });
//     }
//     next();
// });
  
module.exports = router