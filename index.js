const express = require('express');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const cors = require('cors')

const app = express();

app.use(express.urlencoded({
    limit: '10mb',
    extended: true
}))

app.use(express.json({
    limit: '10mb',
    type: "*/*"
}))

app.use(cors())

require('dotenv').config();
const credentials = process.env.GOOGLE_DRIVE_KEY;

async function getSubfolders(folderId) {

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        const driveService = google.drive({
            version: 'v3',
            auth,
        });

        const response = await driveService.files.list({
            q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
            fields: 'files(id, name, webViewLink)',
        });

        const folders = response.data.files;
        return folders;
    } catch (error) {
        console.error('Error al obtener las carpetas:', error);
        return [];
    }
}

app.get('/upload', (req, res) => {
    const folderId = "1xzJAvxjfXdOD_X810ZygKBsaauC9gJzv";

    getSubfolders(folderId)
        .then((folders) => {
            res.send(folders);
        })
        .catch((error) => {
            console.error('Error al obtener las carpetas:', error);
        });
})

app.post('/upload', async (req, res) => {

    const base64Image = req.body.image;
    const nameImage = req.body.name;
    const folderId = req.body.folder;

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: credentials,
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const driveService = google.drive({
            version: 'v3',
            auth
        });

        const fileMetaData = {
            'name': nameImage,
            'parents': [folderId]
        };

        const filePath = path.join(__dirname, nameImage + '.png');
        await saveBase64Image(base64Image, filePath);

        const existingFiles = await driveService.files.list({
            q: `name = '${nameImage}' and '${folderId}' in parents`,
            fields: 'files(id)'
        });

        if (existingFiles.data.files.length > 0) {
            const fileId = existingFiles.data.files[0].id;

            await driveService.files.update({
                fileId: fileId,
                media: {
                    body: fs.createReadStream(filePath),
                },
                fields: 'id',
            });

            removeImageFolder(filePath)

            res.send(`Imagen actualizada en Google Drive con ID: ${fileId}`);
        } else {

            await driveService.files.create({
                resource: fileMetaData,
                media: {
                    mimeType: 'image/jpeg',
                    body: fs.createReadStream(filePath),
                },
                fields: 'id',
            });

            removeImageFolder(filePath)

            res.send(`Imagen subida a Google Drive`);
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Error al procesar la solicitud');
    }
})

function saveBase64Image(base64Image, filePath) {
    return new Promise((resolve, reject) => {
        const matches = base64Image.match(/^data:image\/([a-zA-Z0-9+\/]+);base64,(.+)$/);

        if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const imageData = Buffer.from(matches[2], 'base64');

            fs.writeFile(filePath, imageData, { encoding: 'base64' }, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        } else {
            reject(new Error('Invalid base64 image format'));
        }
    });
}

function removeImageFolder(filePath) {
    fs.unlink(filePath, (error) => {
        if (error) {
            console.error('Error al eliminar el archivo:', error);
        } else {
            console.log('Archivo eliminado correctamente');
        }
    });
}

app.delete('/deleteFile', async (req, res) => {

    const { name, folderId } = req.body

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        const driveService = google.drive({
            version: 'v3',
            auth,
        });

        const existingFiles = await driveService.files.list({
            q: `name = '${name}' and '${folderId}' in parents`,
            fields: 'files(id)'
        });

        if (existingFiles.data.files.length > 0) {
            const fileId = existingFiles.data.files[0].id;

            await driveService.files.delete({
                fileId: fileId,
            });

            res.json({
                status: true,
                message: 'La imagen se elimino correctamente'
            })
        } else {
            res.json({
                status: false,
                message: 'La imagen no se puede eliminar. No existe'
            })
        }

    } catch (error) {
        console.error('Error al eliminar el archivo de Google Drive:', error);
    }
})

const port = process.env.PORT || 4000;

app.listen(port, () => {
    console.log('Servidor iniciado en puerto ' + port);
    console.log(credentials)
});