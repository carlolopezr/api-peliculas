const { Router } = require("express");
const multer  = require('multer');
const fs = require('fs');
const path = require('path');
const { postVideo } = require("../controllers/video");
const { fieldValidator } = require("../helpers/validator");
const { check, body } = require("express-validator");
const { checkFileType } = require("../helpers/customValidations");

const router = Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const id = req.query.id 
        const uploadDir = path.join(`../uploads/${id}`); 
        if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    },
  });
  
  const upload = multer({
    storage:storage, 
    limits: {
        fileSize: 64516992768
    },
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb)
    }
  })


//RUTAS
router.get('/', (req, res) => {
    res.send('Hola mundo')
})

router.post('/',[
    upload.single('video'),
    check('id', 'Falta el id de usuario en la solicitud').not().isEmpty(),
    // body('email', 'Falta el correo del usuario en la solicitud').notEmpty(),
    // body('title', 'Falta el nombre de la película').notEmpty(),
    fieldValidator
] , postVideo)


router.post('/encode')

//Middleware para manejar errores de multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Error en la carga del archivo: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: 'Error en la carga del archivo: ' + err.message });
    }
    next();
});
  
  

module.exports = router