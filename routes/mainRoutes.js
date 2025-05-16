const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const multer = require('multer');
const { mainGestor } = require('../main/gestorProcess');
const { mainLector } = require('../main/lectorProcess');
const { clearCurrentLogFile, createLogger } = require('../utils/logger');

// Redirige directamente a selección de programa
router.get('/', (req, res) => {
    res.render('main');
});

// Ruta dinámica que renderiza la vista correspondiente
router.get('/:programa/:empresa', (req, res) => {
    const { programa, empresa } = req.params;
    const viewPath = `${programa}/${empresa}`;
    res.render(viewPath);
});

// Ruta que renderiza la vista del programa Lector
router.get('/:programa/index', (req, res) => {
    const programa = req.params;
    const viewPath = `${programa}/index`;
    res.render(viewPath);
});

// Configurar multer para lector (solo archivos .xml en memoria)
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/xml' || file.originalname.toLowerCase().endsWith('.xml')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos .xml'));
        }
    }
});

// Ejecutar el proceso para una empresa específica
router.post('/execute-main/:programa/:empresa?', upload.array('files'), async (req, res) => {
    const programa = req.params.programa.toUpperCase(); // Convertir a mayúsculas para evitar errores
    const empresa = req.params.empresa ? req.params.empresa.toUpperCase() : 'INDEX'; // Convertir a mayúsculas para evitar errores
    const password = req.body.password;

    // Validar contraseña por empresa (usa variables de entorno)
    const validPasswords = {
        IENEL: process.env.PASSWORD_IENEL,
        TRJA: process.env.PASSWORD_3JA,
        ENP: process.env.PASSWORD_ENP,
        LECTOR: process.env.PASSWORD_LECTOR
    };

    const expectedPassword = programa === 'LECTOR'
        ? validPasswords['LECTOR']
        : validPasswords[empresa];


    if (password !== expectedPassword) {
        return res.status(401).send('Contraseña incorrecta');
    }

    try {
        const { log, logError } = createLogger(programa, empresa);

        await clearCurrentLogFile(programa, empresa);

        // --- Ejecución por tipo de programa ---
        switch (programa) {
            case 'LECTOR':
                if (!req.files || req.files.length === 0) {
                    return res.status(400).send('No se recibieron archivos válidos');
                }

                const xmlFiles = req.files.map(file => ({
                    filename: file.originalname,
                    content: file.buffer.toString()
                }));

                await mainLector(xmlFiles, log, logError); // lógica del programa lector
                break;

            case 'GESTOR':
                if (!empresa) {
                    return res.status(400).send('Empresa requerida para este programa');
                }
                await mainGestor(empresa, log, logError); // lógica común multientidad
                break;

            default:
                return res.status(400).send('Programa no válido');
        }

        res.status(200).send('Proceso iniciado');
    } catch (error) {
        logError('Error ejecutando proceso:', error);
        console.error('Error ejecutando proceso:', error);
        res.status(500).send('Error interno');
    }
});

// Obtener logs actuales por empresa
router.get('/get-logs/:programa/:empresa', (req, res) => {
    const { programa, empresa } = req.params;
    const logError = createLogger(programa, empresa);
    const logFilePath = path.join(__dirname, '..', 'logs', programa.toLowerCase(), empresa.toLowerCase(), 'currentEvents.log');

    try {
        const logs = fs.readFileSync(logFilePath, 'utf-8');
        res.send(logs);
    } catch (error) {
        logError(`[Error] Error al leer logs ${programa}/${empresa}:`, error);
        console.error(`[Error] Error al leer logs ${programa}/${empresa}:`, error);
        res.status(500).send('Error al obtener logs');
    }
});

module.exports = router;