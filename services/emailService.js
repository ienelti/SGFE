const path = require('path');
const fs = require('fs');
const { Client } = require('@microsoft/microsoft-graph-client');
const { getAccessToken } = require('./authService');
const { getUniqueFileName } = require('../utils/fileUtils');
require('isomorphic-fetch'); // Necesario para Graph Client en Node.js

// 1. Obtener conexión (token)
async function connectEmail(logError) {
    try {
        const accessToken = await getAccessToken(logError);
        return accessToken;
    } catch (err) {
        logError('[Error] No se pudo obtener el token:', err.message);
        console.error('[Error] No se pudo obtener el token:', err.message);
        return null;
    }
}

// 2. Descargar adjuntos ZIP de correos no leídos para la empresa especificada
async function downloadAttachments(accessToken, empresa, log, logError) {
    const sharedMailboxes = {
        IENEL: process.env.IENEL_SHARED_MAILBOX,
        TRJA: process.env.TRJA_SHARED_MAILBOX,
        ENP: process.env.ENP_SHARED_MAILBOX
    };

    const sharedMailbox = sharedMailboxes[empresa];
    if (!sharedMailbox) {
        logError(`[Error] No se definió buzón compartido para la empresa: ${empresa}`);
        return [];
    }

    const downloadFolders = {
        IENEL: process.env.IENEL_DOWNLOAD_FOLDER,
        TRJA: process.env.TRJA_DOWNLOAD_FOLDER,
        ENP: process.env.ENP_DOWNLOAD_FOLDER
    };

    const downloadFolder = path.join(downloadFolders[empresa], '..', 'DATAICO');
    if (!downloadFolder) {
        logError(`[Error] No se definió carpeta de descarga para ${empresa}`);
        return [];
    }

    // Inicializar cliente Graph
    const client = Client.init({
        authProvider: (done) => done(null, accessToken)
    });

    try {
        let downloadedFiles = []; // aquí se almacenan las rutas
        let totalAdjuntos = 0;

        const messagesResponse = await client
            .api(`/users/${sharedMailbox}/mailFolders/inbox/messages`)
            .top(150)
            .select('id,subject,from,flag,hasAttachments')
            .orderby('receivedDateTime DESC') // del más reciente al más antiguo
            .get();

        const messages = messagesResponse.value.filter(
            msg => msg.flag?.flagStatus !== 'flagged' && msg.hasAttachments
        );

        for (const msg of messages) {
            const attachments = await client
                .api(`/users/${sharedMailbox}/messages/${msg.id}/attachments`)
                .get();

            const zipAdjuntos = attachments.value.filter(att =>
                att.name?.toLowerCase().endsWith('.zip') &&
                att.contentBytes
            );

            if (zipAdjuntos.length > 0) {
                for (const att of zipAdjuntos) {
                    const buffer = Buffer.from(att.contentBytes, 'base64');

                    if (empresa === 'IENEL') {
                        // Guardar en DATAICO y hacer copia a carpeta oficial
                        const originalZipPath = getUniqueFileName(path.join(downloadFolder, att.name));
                        fs.writeFileSync(originalZipPath, buffer);

                        const gestorZipPath = getUniqueFileName(path.join(downloadFolders[empresa], att.name));
                        fs.copyFileSync(originalZipPath, gestorZipPath);

                        downloadedFiles.push(gestorZipPath); // Solo esta copia es usada por el Gestor
                    } else {
                        // Para TRJA y ENP, guardar directamente en carpeta oficial sin usar DATAICO
                        const directZipPath = getUniqueFileName(path.join(downloadFolders[empresa], att.name));
                        fs.writeFileSync(directZipPath, buffer);

                        downloadedFiles.push(directZipPath);
                    }
                }
            
                // Marcar mensaje con bandera roja (flag)
                const marcado = await marcarCorreo(client, sharedMailbox, msg.id, retries=3, logError);
                if (!marcado) {
                    logError(`[Error] No se pudo marcar el correo ${msg.subject} (${msg.id}) después de varios intentos`);
                } else {
                    log(`Mensaje marcado con bandera: ${msg.subject}`);
                }
                
                totalAdjuntos += zipAdjuntos.length;
            }
        }

        log(`Se descargaron ${totalAdjuntos} archivos adjuntos .ZIP del correo ${sharedMailbox}.`);
        return downloadedFiles; // retornar rutas descargadas;
    } catch (error) {
        logError('[Error] Fallo al acceder o marcar correos:', error.message);
        console.error('[Error] Fallo al acceder o marcar correos:', error.message);
        return [];
    }
}

// Refuerza el marcado con un retry
async function marcarCorreo(client, sharedMailbox, msgId, retries, logError) {
    for (let intento = 1; intento <= retries; intento++) {
        try {
            await client.api(`/users/${sharedMailbox}/messages/${msgId}`)
                .update({ flag: { flagStatus: 'flagged' } });

            // Verificación opcional
            const confirmMsg = await client.api(`/users/${sharedMailbox}/messages/${msgId}`).select('flag').get();
            if (confirmMsg.flag?.flagStatus === 'flagged') {
                return true;
            }

        } catch (error) {
            logError(`[Error] Reintento #${intento} falló al marcar correo ${msgId}:`, error.message);
            console.error(`[Error] Reintento #${intento} falló al marcar correo ${msgId}:`, error.message);
        }
        await new Promise(res => setTimeout(res, 1500));
    }
    return false;
}


module.exports = { connectEmail, downloadAttachments };
