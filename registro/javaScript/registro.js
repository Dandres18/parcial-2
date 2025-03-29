document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector(".form");

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const nombre = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const contrasena = document.getElementById("password").value; // No usar trim() en contraseña

        if (!nombre || !email || !contrasena) {
            alert("Todos los campos son obligatorios");
            return;
        }

        try {
            const respuesta = await fetch("http://127.0.0.1:8000/api/usuarios", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    NOMBRE: nombre,
                    EMAIL: email,
                    CONTRASENA: contrasena
                }),
            });

            if (!respuesta.ok) {
                const errorData = await respuesta.json();
                throw new Error(errorData.detail || "Error en el registro");
            }

            const datos = await respuesta.json();
            alert(datos.mensaje || "Registro exitoso");
            window.location.href = "http://127.0.0.1:5500/login/index.html";
        } catch (error) {
            console.error("Error completo:", error);
            alert(error.message || "Error al conectar con el servidor");
        }
    });
});