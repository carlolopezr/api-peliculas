const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const { request, response } = require('express');
const path = require('path');
const getResolution = require('../helpers/getResolution');
const busboy = require('busboy');
const streamToBuffer = require('fast-stream-to-buffer');
const md5 = require('md5');
/* const fs = require('fs-extra'); */

const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'base64').toString());

const storageClient = new Storage({
	projectId: 'cine-independiente-398119',
	credentials,
});

const bucketName = 'peliculas_cineindependiente';

//!Busboy
const postVideoOnServer = async (req, res, next) => {
	const bb = busboy({ headers: req.headers });

	let filePath = '';
	let fileMimetype = '';
	bb.on('file', (_, file, info) => {
		const fileName = info.filename;
		fileMimetype = info.mimeType;
		filePath = `./uploads/${fileName}`;
		const stream = fs.createWriteStream(filePath);
		file.pipe(stream);
	});

	bb.on('close', () => {
		req.pathToFile = filePath;
		req.fileMimetype = fileMimetype;
		res.status(200).json({ msg: 'Terminada' });
		next();
	});
	req.pipe(bb);
	return;
};

//!Chunks front-end
const postVideo = async (req, res) => {
	const { name, currentChunkIndex, totalChunks } = req.query;
	const firstChunk = parseInt(currentChunkIndex) === 0;
	const lastChunk = parseInt(currentChunkIndex) === parseInt(totalChunks) - 1;
	const ext = name.split('.').pop();
	const data = req.body.toString().split(',')[1];
	const buffer = Buffer.from(data, 'base64');
	const tmpFilename = 'tmp_' + md5(name + req.ip) + '.' + ext;
	if (firstChunk && fs.existsSync('./uploads/' + tmpFilename)) {
		fs.unlinkSync('./uploads/' + tmpFilename);
	}
	fs.appendFileSync('./uploads/' + tmpFilename, buffer);
	if (lastChunk) {
		const finalFilename = md5(Date.now()).substr(0, 6) + '.' + ext;
		fs.renameSync('./uploads/' + tmpFilename, './uploads/' + finalFilename);
		res.json({ finalFilename });
	} else {
		res.json('ok');
	}
};

const encode = async (req = request, res = response) => {
	const { filename, id, resolution } = req.body;
	const { height } = resolution;
};

module.exports = {
	postVideo,
	encode,
	postVideoOnServer,
};
