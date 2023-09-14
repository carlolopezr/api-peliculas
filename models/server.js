const express = require('express')
const cors = require('cors')


class Server {

    constructor(){
        this.app = express();

        this.port = process.env.PORT;

        this.paths= {
            video:'/api/video'
        };

        this.middlewares();

        this.routes();
        
    }

    middlewares(){

        this.app.options('*', cors())
        this.app.use(cors())

        this.app.use(express.json())
    }

    routes() {
        this.app.use(this.paths.video, require('../routes/video'))
    }

    listen(){
        this.app.listen(this.port, () => {
            console.log('Servidor corriendo en puerto', this.port);
        });
    }
}

module.exports = Server;