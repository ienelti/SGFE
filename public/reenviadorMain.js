document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (!path.startsWith('/reenviador/')) return;

    const [ , programa ] = window.location.pathname.split('/');
    let isRunning = false; // Bandera para controlar el scroll automático

    //////////////////////////// LÓGICA PARA EL REGISTRO DE LOGS EN LA VISTA DE CADA PROGRAMA ////////////////////////////
    // Obtener el contenedor de logs
    const logsContainer = document.getElementById('logsContainer');

    // Función para actualizar los logs en el contenedor
    async function updateLogs() {
        try {
            const response = await fetch(`/get-logs/${programa}/index`);
            const logs = await response.text();

            logsContainer.innerHTML = '';
            logs.split('\n').forEach(line => {
                if (line.trim()) {
                    const logElement = document.createElement('div');
                    logElement.style.color = line.includes('[Error]') ? 'red'
                                        : line.includes('[Advertencia]') ? 'orange'
                                        : 'black';
                    logElement.textContent = line;
                    logsContainer.appendChild(logElement);
                }
            });

            if (isRunning) logsContainer.scrollTop = logsContainer.scrollHeight;
        } catch (err) {
            console.error('Error al obtener logs', err);
        }
    }

    // Actualizar los logs cada dos segundos
    setInterval(updateLogs, 2000);
    updateLogs();
    //////////////////////////// LÓGICA PARA EL REGISTRO DE LOGS EN LA VISTA DE CADA PROGRAMA ////////////////////////////
});