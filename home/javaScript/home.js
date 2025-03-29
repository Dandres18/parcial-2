// home.js - Versión con filtrado por usuario

document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let productos = [];
    let productoEditando = null;
    const token = localStorage.getItem('token');
    let usuarioId = null; // Variable para almacenar el ID del usuario
    
    // Elementos del DOM
    const productosLista = document.getElementById('productosLista');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const formAgregarProducto = document.getElementById('formAgregarProducto');
    const agregarModal = document.getElementById('agregarModal');
    const modalInstance = new bootstrap.Modal(agregarModal);
    const agregarModalLabel = document.getElementById('agregarModalLabel');
    
    // Obtener el ID del usuario desde el token
    if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        usuarioId = payload.usuario_id;
    }
    
    // Event listeners
    formAgregarProducto.addEventListener('submit', manejarEnvioFormulario);
    
    // Inicializar la aplicación
    cargarProductos();
    
    // Funciones
    
    async function cargarProductos() {
        if (!usuarioId) {
            alert('No se pudo identificar al usuario');
            return;
        }
        
        mostrarLoading(true);
        
        try {
            const response = await fetch('http://localhost:8000/api/productos', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Error al cargar productos');
            }
            
            productos = await response.json();
            renderizarProductos();
        } catch (error) {
            console.error('Error:', error);
            alert('Error al cargar los productos. Por favor, inténtalo de nuevo.');
        } finally {
            mostrarLoading(false);
        }
    }
    
    function renderizarProductos() {
        // Limpiar la lista
        while (productosLista.firstChild) {
            productosLista.removeChild(productosLista.firstChild);
        }
        
        if (productos.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.className = 'text-center py-4';
            
            const icon = document.createElement('i');
            icon.className = 'bi bi-exclamation-circle fs-4';
            
            const p = document.createElement('p');
            p.className = 'mt-2';
            p.textContent = 'No hay productos registrados';
            
            td.appendChild(icon);
            td.appendChild(p);
            tr.appendChild(td);
            productosLista.appendChild(tr);
            return;
        }
        
        // Filtrar productos por usuario
        const productosUsuario = productos.filter(p => p.ID_USER === usuarioId);
        
        productosUsuario.forEach(producto => {
            const fila = document.createElement('tr');
            
            // Crear celdas
            const tdNombre = document.createElement('td');
            tdNombre.textContent = producto.NOMBRE;
            
            const tdDescripcion = document.createElement('td');
            tdDescripcion.textContent = producto.DESCRIPCION || 'N/A';
            
            const tdValor = document.createElement('td');
            tdValor.textContent = `$${producto.VALOR.toFixed(2)}`;
            
            const tdCantidad = document.createElement('td');
            tdCantidad.textContent = producto.CANTIDAD;
            
            const tdAcciones = document.createElement('td');
            tdAcciones.className = 'text-nowrap';
            
            // Botón editar
            const btnEditar = document.createElement('button');
            btnEditar.className = 'btn btn-sm btn-outline-primary editar-btn';
            btnEditar.dataset.id = producto.ID;
            
            const iconEditar = document.createElement('i');
            iconEditar.className = 'bi bi-pencil';
            
            btnEditar.appendChild(iconEditar);
            btnEditar.appendChild(document.createTextNode(' Editar'));
            
            // Botón eliminar
            const btnEliminar = document.createElement('button');
            btnEliminar.className = 'btn btn-sm btn-outline-danger eliminar-btn ms-2';
            btnEliminar.dataset.id = producto.ID;
            
            const iconEliminar = document.createElement('i');
            iconEliminar.className = 'bi bi-trash';
            
            btnEliminar.appendChild(iconEliminar);
            btnEliminar.appendChild(document.createTextNode(' Eliminar'));
            
            // Agregar botones a la celda de acciones
            tdAcciones.appendChild(btnEditar);
            tdAcciones.appendChild(btnEliminar);
            
            // Agregar celdas a la fila
            fila.appendChild(tdNombre);
            fila.appendChild(tdDescripcion);
            fila.appendChild(tdValor);
            fila.appendChild(tdCantidad);
            fila.appendChild(tdAcciones);
            
            // Agregar fila a la tabla
            productosLista.appendChild(fila);
        });
        
        // Agregar event listeners a los botones después de renderizar
        document.querySelectorAll('.editar-btn').forEach(btn => {
            btn.addEventListener('click', prepararEdicion);
        });
        
        document.querySelectorAll('.eliminar-btn').forEach(btn => {
            btn.addEventListener('click', confirmarEliminacion);
        });
    }
    
    function mostrarLoading(mostrar) {
        loadingIndicator.style.display = mostrar ? 'block' : 'none';
        document.getElementById('productosTabla').style.display = mostrar ? 'none' : 'table';
    }
    
    function prepararEdicion(event) {
        const id = parseInt(event.currentTarget.getAttribute('data-id'));
        productoEditando = productos.find(p => p.ID === id);
        
        if (!productoEditando) return;
        
        // Configurar el modal para edición
        agregarModalLabel.textContent = 'Editar Producto';
        document.getElementById('nombreProducto').value = productoEditando.NOMBRE;
        document.getElementById('descripcionProducto').value = productoEditando.DESCRIPCION || '';
        document.getElementById('valorProducto').value = productoEditando.VALOR;
        document.getElementById('cantidadProducto').value = productoEditando.CANTIDAD;
        
        modalInstance.show();
    }
    
    async function manejarEnvioFormulario(event) {
        event.preventDefault();
        
        const nombre = document.getElementById('nombreProducto').value.trim();
        const descripcion = document.getElementById('descripcionProducto').value.trim();
        const valor = parseFloat(document.getElementById('valorProducto').value);
        const cantidad = parseInt(document.getElementById('cantidadProducto').value);
        
        // Validación básica
        if (!nombre || isNaN(valor) || isNaN(cantidad)) {
            alert('Por favor complete todos los campos requeridos correctamente.');
            return;
        }
        
        const productoData = {
            NOMBRE: nombre,
            DESCRIPCION: descripcion || null,
            VALOR: valor,
            CANTIDAD: cantidad,
            ID_USER: usuarioId // Asegurar que el producto se asocie al usuario
        };
        
        mostrarLoading(true);
        
        try {
            if (productoEditando) {
                await actualizarProducto(productoEditando.ID, productoData);
            } else {
                await crearProducto(productoData);
            }
            
            // Recargar la lista de productos
            await cargarProductos();
            
            // Limpiar el formulario y cerrar el modal
            formAgregarProducto.reset();
            modalInstance.hide();
            productoEditando = null;
            
        } catch (error) {
            console.error('Error:', error);
            alert('Ocurrió un error al procesar la solicitud. Por favor, inténtalo de nuevo.');
        } finally {
            mostrarLoading(false);
        }
    }
    
    async function crearProducto(productoData) {
        const response = await fetch('http://localhost:8000/api/productos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productoData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error al crear el producto');
        }
        
        return await response.json();
    }
    
    async function actualizarProducto(id, productoData) {
        const response = await fetch(`http://localhost:8000/api/productos/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productoData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error al actualizar el producto');
        }
        
        return await response.json();
    }
    
    function confirmarEliminacion(event) {
        const id = parseInt(event.currentTarget.getAttribute('data-id'));
        const producto = productos.find(p => p.ID === id);
        
        if (!producto) return;
        
        if (confirm(`¿Estás seguro de que deseas eliminar el producto "${producto.NOMBRE}"?`)) {
            eliminarProducto(id);
        }
    }
    
    async function eliminarProducto(id) {
        mostrarLoading(true);
        
        try {
            const response = await fetch(`http://localhost:8000/api/productos/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Error al eliminar el producto');
            }
            
            // Recargar la lista de productos
            await cargarProductos();
        } catch (error) {
            console.error('Error:', error);
            alert('Ocurrió un error al eliminar el producto. Por favor, inténtalo de nuevo.');
        } finally {
            mostrarLoading(false);
        }
    }
    
    // Resetear el modal cuando se cierra
    agregarModal.addEventListener('hidden.bs.modal', function() {
        formAgregarProducto.reset();
        agregarModalLabel.textContent = 'Agregar Producto';
        productoEditando = null;
    });
});