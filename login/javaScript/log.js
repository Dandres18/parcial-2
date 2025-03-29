document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector(".form");

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const contrasena = document.getElementById("password").value.trim();

        if (!email || !contrasena) {
            alert("Todos los campos son obligatorios");
            return;
        }

        try {
            const respuesta = await fetch("http://127.0.0.1:8000/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    EMAIL: email,  // 🔹 Ahora en mayúsculas para coincidir con FastAPI
                    CONTRASENA: contrasena,
                }),
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(datos.detail || "Error al iniciar sesión");
            }

            alert("Inicio de sesión exitoso");

            // Guardar el token en localStorage para futuras peticiones
            localStorage.setItem("token", datos.token);

            // Redirigir al dashboard
            window.location.href = "http://127.0.0.1:5500/home/home.html";
        } catch (error) {
            console.error("Error:", error);
            alert("Credenciales incorrectas o error en el servidor");
        }
    });
});
