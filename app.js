require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const mainRoutes = require('./routes/mainRoutes');
const { mainReenviador } = require('./main/reenviadorProcess');

const app = express();
const PORT = process.env.PORT || 3000;
const ADDRESS = process.env.ADDRESS || '127.0.0.1';

// Configuración de EJS + Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts); // Habilita el uso de layouts
app.set('layout', 'layout'); // Usa views/layout.ejs como layout por defecto
app.use((req, res, next) => {
  res.locals.request = req;next();
});

// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Usar las rutas definidas
app.use('/', mainRoutes);

// Iniciar el servidor
app.listen(PORT, ADDRESS, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

/* // Ejecutar de inmediato al iniciar
mainReenviador();

// Ejecutar cada 15 minutos
setInterval(() => {
  console.log(" Ejecutando nuevamente Reenviador de Facturas a DATAICO...");
  mainReenviador();
}, 15 * 60 * 1000); // 15 minutos en milisegundos */