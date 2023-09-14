const { Router } = require("express");
const multer  = require('multer');
const { postVideo } = require("../controllers/video");

const router = Router();
const storage = multer.diskStorage({
    destination: "C:\\Users\\Carlos\\Desktop\\api-peliculas\\videosStorage",
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
});
const upload = multer({storage:storage})


//RUTAS
router.get('/', (req, res) => {
    res.send('Hola mundo')
})

router.post('/', upload.single('video'), postVideo)


module.exports = router