document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (!path.startsWith('/lector/')) return;
    
    // Extraer programa desde la URL: /gestor/ienel
    const [ , programa ] = window.location.pathname.split('/');

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

    // Referencias a elementos
    const selectFileInput = document.getElementById('selectFileInput');
    const selectFolderInput = document.getElementById('selectFolderInput');
    const selectedFiles = document.getElementById('selectedFiles');
    const selectedFolder = document.getElementById('selectedFolder');
    const executeButton = document.getElementById('executeButton');
    const clearFileSelection = document.getElementById('clearFileSelection');
    const clearFolderSelection = document.getElementById('clearFolderSelection');

    let xmlFiles = []; // Variable global para almacenar los archivos XML filtrados

    // Mostrar botón de ejecución si se selecciona algún archivo o carpeta y desactivar el otro método de selección
    function handleFileSelection(event) {
        const files = Array.from(event.target.files); // Convertir FileList a Array
        // Filtrar solo archivos con extensión .xml
        xmlFiles = files.filter(file => file.name.toLowerCase().endsWith('.xml'));

        if (xmlFiles.length > 0) {
            executeButton.style.display = 'block'; // Mostrar botón
            if (event.target === selectFileInput) {
                // Lógica para mostrar nombres de archivos seleccionados
                if (xmlFiles.length === 1) {
                    selectedFiles.textContent = xmlFiles[0].name; // Nombre del único archivo .xml
                } else {
                    selectedFiles.textContent = `${xmlFiles.length} archivos .xml seleccionados`; // Resumen de múltiples archivos .xml
                }
                selectFolderInput.disabled = true; // Desactivar selección de carpeta
                clearFileSelection.style.display = 'inline-block'; // Mostrar botón "X" para archivos
                document.querySelector('.btn_custom_folder').classList.add('btn_disabled'); // Desactivar hover en carpeta
            } else if (event.target === selectFolderInput) {
                // Mostrar el nombre de la carpeta seleccionada
                const folderName = xmlFiles[0].webkitRelativePath.split('/')[0]; // Extraer nombre de carpeta
                selectedFolder.textContent = `${xmlFiles.length} archivos .xml en ${folderName}`; // Mostrar cantidad y nombre de carpeta
                selectFileInput.disabled = true; // Desactivar selección de archivos
                clearFolderSelection.style.display = 'inline-block'; // Mostrar botón "X" para carpeta
                document.querySelector('.btn_custom_file').classList.add('btn_disabled'); // Desactivar hover en archivos
            }
        } else {
            // No hay archivos .xml seleccionados
            selectedFiles.textContent = 'No se seleccionaron archivos .xml válidos';
            selectedFolder.textContent = 'No se seleccionaron archivos .xml válidos';
            executeButton.style.display = 'none'; // Ocultar botón de ejecución
        }
    }

    selectFileInput.addEventListener('change', handleFileSelection);
    selectFolderInput.addEventListener('change', handleFileSelection);

    // Función para limpiar selección y restaurar estado inicial
    function clearSelection(type) {
        if (type === 'file') {
            selectFileInput.value = ''; // Limpiar selección de archivos
            selectedFiles.textContent = 'Ningún archivo seleccionado'; // Restablecer texto
            clearFileSelection.style.display = 'none'; // Ocultar botón "X"
            selectFolderInput.disabled = false; // Reactivar selección de carpeta
            document.querySelector('.btn_custom_folder').classList.remove('btn_disabled'); // Reactivar hover en carpeta
        } else if (type === 'folder') {
            selectFolderInput.value = ''; // Limpiar selección de carpeta
            selectedFolder.textContent = 'Ninguna carpeta seleccionada'; // Restablecer texto
            clearFolderSelection.style.display = 'none'; // Ocultar botón "X"
            selectFileInput.disabled = false; // Reactivar selección de archivos
            document.querySelector('.btn_custom_file').classList.remove('btn_disabled'); // Reactivar hover en archivos
        }
        executeButton.style.display = 'none'; // Ocultar botón de ejecución
    }

    // Vincular botones "X" a la función clearSelection
    clearFileSelection.addEventListener('click', () => clearSelection('file'));
    clearFolderSelection.addEventListener('click', () => clearSelection('folder'));

    // Función para restablecer selección si no hay archivos o carpetas seleccionados
    function resetSelections() {
        selectedFiles.textContent = 'Ningún archivo seleccionado';
        selectedFolder.textContent = 'Ninguna carpeta seleccionada';
        executeButton.style.display = 'none'; // Ocultar botón de ejecución
        clearFileSelection.style.display = 'none'; // Ocultar botón "X"
        clearFolderSelection.style.display = 'none'; // Ocultar botón "X"
        selectFileInput.value = ''; // Limpiar selección de archivos
        selectFolderInput.value = ''; // Limpiar selección de carpeta
        selectFileInput.disabled = false;
        selectFolderInput.disabled = false;
        document.querySelector('.btn_custom_folder').classList.remove('btn_disabled'); // Reactivar hover en carpeta
        document.querySelector('.btn_custom_file').classList.remove('btn_disabled'); // Reactivar hover en archivos
    }

    let isRunning = false; // Bandera para controlar el scroll automático

    submitPasswordBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        if (!password) return;

        passwordModal.style.display = 'none';
        executeButton.disabled = true;
        isRunning = true;

        const formData = new FormData();
        for (let file of xmlFiles) {
            formData.append('files', file);
        }
        formData.append('password', password);

        try {
            const response = await fetch(`/execute-main/${programa}`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                alert('El programa se ejecutó correctamente');
            } else {
                alert('Contraseña incorrecta o error en la ejecución');
            }
        } catch (error) {
            alert('Error al conectar con el servidor');
        } finally {
            executeButton.disabled = false;
            resetSelections();
            isRunning = false;
        }
    });

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