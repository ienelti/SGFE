//////////////////////////// LÓGICA DEL MENÚ PRINCIPAL PARA ESCOGER PROGRAMA Y EMPRESA ////////////////////////////
let selectedProgram = '';

function selectProgram(program) {
    selectedProgram = program;

    // Quitar clase activa de todos los botones de programa
    const programButtons = document.querySelectorAll('#programas button');
    programButtons.forEach(btn => btn.classList.remove('selected-program'));

    // Agregar clase al botón seleccionado
    const selectedBtn = document.querySelector(`#programas button[data-program="${program}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected-program');
        
    }

    // Si el programa es "lector", redirige directamente
    if (program === 'lector' || program === 'reenviador') {
        setTimeout(() => {
            window.location.href = `/${program}/index`;
        }, 300); // Le dejamos el delay para que se vea el efecto visual
        return;
    }

    // Si es otro programa, habilitar botones de empresa
    const companyButtons = document.querySelectorAll('#empresas button');
    companyButtons.forEach(btn => btn.disabled = false);
}

function selectCompany(company) {
    if (!selectedProgram) return;

    // Quitar clase activa de todos los botones de empresa
    const companyButtons = document.querySelectorAll('#empresas button');
    companyButtons.forEach(btn => btn.classList.remove('selected-company'));

    // Marcar el botón seleccionado
    const selectedBtn = document.querySelector(`#empresas button[data-company="${company}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected-company');
    }

    // Esperar 300ms para que se vea el efecto antes de redirigir
    setTimeout(() => {
        window.location.href = `/${selectedProgram}/${company}`;
    }, 300);
}

// Limpiar los estados visuales manualmente al cargar la página
function resetMainPageUI() {
    const programButtons = document.querySelectorAll('#programas button');
    programButtons.forEach(btn => btn.classList.remove('selected-program'));

    const companyButtons = document.querySelectorAll('#empresas button');
    companyButtons.forEach(btn => {
        btn.classList.remove('selected-company');
        btn.disabled = true;
    });

    selectedProgram = '';
}

// Ejecutar al cargar normalmente
window.addEventListener('DOMContentLoaded', resetMainPageUI);

// Ejecutar si se viene del historial (bfcache)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        resetMainPageUI();
    }
});
//////////////////////////// LÓGICA DEL MENÚ PRINCIPAL PARA ESCOGER PROGRAMA Y EMPRESA ////////////////////////////