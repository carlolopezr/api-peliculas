const { Router } = require("express");

const { postVideoOnServer, postVideoOnCloudStorage, 
    uploadImageToServer, uploadImageToCloudinary,videoDetection, generateHLS } = require("../controllers/video");

const { fieldValidator } = require("../helpers/validator");
const { check } = require("express-validator");
const router = Router()

//RUTAS
router.get('/', (req, res) => {
    res.send('Hola mundo')
})

router.post('/',[
    check('id', 'Falta el id de usuario en la solicitud').not().isEmpty(),
    check('date', 'Falta el campo date en la solicitud').not().isEmpty(),
    fieldValidator,  
], postVideoOnServer, generateHLS, postVideoOnCloudStorage)


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