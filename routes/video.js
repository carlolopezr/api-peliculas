const { Router } = require("express");

const { postVideoOnServer, postVideoOnCloudStorage, 
    uploadImageToServer, uploadImageToCloudinary,videoDetection, generateHLS, deleteMovie } = require("../controllers/video");

const { fieldValidator } = require("../helpers/validator");
const { check, body } = require("express-validator");
const errorHandler = require("../middlewares/errorHandler");
const router = Router()

//RUTAS
router.get('/', (req, res) => {
    res.send('Hola mundo')
})

router.post('/',[
    check('id', 'Falta el id de usuario en la solicitud').not().isEmpty(),
    check('date', 'Falta el campo date en la solicitud').not().isEmpty(),
    fieldValidator,  
], postVideoOnServer, generateHLS, postVideoOnCloudStorage, videoDetection, errorHandler)

router.post('/upload-image', uploadImageToServer, uploadImageToCloudinary);

router.delete('/delete-movie',[
    check('id', 'Falta el id de usuario en la solicitud').not().isEmpty(),
    check('date', 'Falta el campo date en la solicitud').not().isEmpty(),
], deleteMovie)

  
module.exports = router