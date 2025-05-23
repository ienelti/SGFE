document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (!path.startsWith('/gestor/')) return;

    // Extraer programa y empresa desde la URL: /gestor/ienel
    const [ , programa, empresa ] = window.location.pathname.split('/');

    const passwordModal = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('passwordInput');
    const submitPasswordBtn = document.getElementById('submitPassword');

    // Escuchar el clic en el botón de ejecución
    document.getElementById('executeButton').addEventListener('click', () => {
        passwordInput.value = '';
        passwordModal.style.display = 'block';
        passwordInput.focus();
    });

    // Cerrar modal al presionar Escape
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            passwordModal.style.display = 'none';
        }
    });

    // Cerrar modal al hacer clic fuera del contenido
    passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            passwordModal.style.display = 'none';
        }
    });

    // Enviar con Enter dentro del input
    document.getElementById('passwordInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submitPassword').click();
        }
    });

    let isRunning = false; // Bandera para controlar el scroll automático

    submitPasswordBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        if (!password) return; // Si no se proporciona contraseña, salir

        passwordModal.style.display = 'none';
        const executeBtn = document.getElementById('executeButton');
        executeBtn.disabled = true; // Desactivar el botón para evitar múltiples clics
        isRunning = true; // Activar el scroll automático

        try {
            const response = await fetch(`/execute-main/${programa}/${empresa}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                alert('Proceso de ejecución terminado');
            } else {
                alert('Contraseña incorrecta o error en la ejecución');
            }
        } catch (error) {
            alert('Error al conectar con el servidor');
        } finally {
            executeBtn.disabled = false; // Reactivar el botón
            isRunning = false; // Desactivar el scroll automático
        }
    });

    //////////////////////////// LÓGICA PARA EL REGISTRO DE LOGS EN LA VISTA DE CADA PROGRAMA ////////////////////////////
    // Obtener el contenedor de logs
    const logsContainer = document.getElementById('logsContainer');

    // Función para actualizar los logs en el contenedor
    async function updateLogs() {
        try {
            const response = await fetch(`/get-logs/${programa}/${empresa}`);
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