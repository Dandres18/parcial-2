from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text, TIMESTAMP
from sqlalchemy.orm import sessionmaker, declarative_base, Session, relationship
import jwt
import datetime

# Configuración de seguridad
SECRET_KEY = "clave_super_secreta"
ALGORITHM = "HS256"

# Configuración de la base de datos
DATABASE_URL = "mysql+pymysql://root@localhost/gestion_productos"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Definición del modelo de Usuario
class Usuario(Base):
    __tablename__ = "USUARIOS"
    ID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    NOMBRE = Column(String(100), nullable=False)
    EMAIL = Column(String(100), unique=True, nullable=False)
    CONTRASENA = Column(String(255), nullable=False)
    FECHA_CREACION = Column(TIMESTAMP)
    productos = relationship("Producto", back_populates="usuario")


class Producto(Base):
    __tablename__ = "PRODUCTOS"
    ID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    NOMBRE = Column(String(100), nullable=False)
    DESCRIPCION = Column(Text)
    VALOR = Column(Float, nullable=False)
    CANTIDAD = Column(Integer, nullable=False)
    ID_USER = Column(Integer, ForeignKey("USUARIOS.ID"), nullable=True)
    FECHA_CREACION = Column(TIMESTAMP)
    usuario = relationship("Usuario", back_populates="productos")


Base.metadata.create_all(bind=engine)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class UsuarioSchema(BaseModel):
    NOMBRE: str
    EMAIL: str
    CONTRASENA: str

class LoginSchema(BaseModel):
    EMAIL: str
    CONTRASENA: str

class ProductoSchema(BaseModel):
    NOMBRE: str
    DESCRIPCION: str | None = None
    VALOR: float
    CANTIDAD: int
    ID_USER: int | None = None

def obtener_usuario_actual(request: Request, db: Session = Depends(get_db)):
    token = request.headers.get("Authorization")
    if token is None:
        raise HTTPException(status_code=401, detail="Token no proporcionado")

    token = token.split("Bearer ")[-1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        usuario = db.query(Usuario).filter(Usuario.EMAIL == email).first()
        if usuario is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return usuario
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

# Rutas de Usuarios
@app.post("/api/usuarios")
def crear_usuario(usuario: UsuarioSchema, db: Session = Depends(get_db)):
    # Validación adicional para contraseña
    if len(usuario.CONTRASENA) < 4:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres")
    
    usuario_existente = db.query(Usuario).filter(Usuario.EMAIL == usuario.EMAIL).first()
    if usuario_existente:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    # Guardar contraseña en texto plano 
    nuevo_usuario = Usuario(
        NOMBRE=usuario.NOMBRE,
        EMAIL=usuario.EMAIL,
        CONTRASENA=usuario.CONTRASENA,
        FECHA_CREACION=datetime.datetime.now()
    )
    
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return {"mensaje": "Usuario creado exitosamente", "id": nuevo_usuario.ID}

@app.get("/api/usuarios")
def obtener_usuarios(db: Session = Depends(get_db)):
    usuarios = db.query(Usuario).all()
    return usuarios

# Ruta de Login
@app.post("/api/login")
def login(credenciales: LoginSchema, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.EMAIL == credenciales.EMAIL).first()

    if not usuario:
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    
    if credenciales.CONTRASENA != usuario.CONTRASENA:
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

    token_data = {
        "sub": usuario.EMAIL,
        "usuario_id": usuario.ID, 
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2),
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    response = JSONResponse(content={
        "mensaje": "Login exitoso",
        "token": token,
        "usuario_id": usuario.ID
    })
    response.headers["Access-Control-Allow-Origin"] = "http://127.0.0.1:5500"
    return response

# Rutas de Productos 
@app.post("/api/productos")
def crear_producto(producto: ProductoSchema, request: Request, db: Session = Depends(get_db)):
    usuario = obtener_usuario_actual(request, db)
    producto.ID_USER = usuario.ID  # Asignar el producto al usuario actual
    nuevo_producto = Producto(**producto.dict())
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)
    return {"mensaje": "Producto creado exitosamente"}

@app.get("/api/productos")
def obtener_productos(request: Request, db: Session = Depends(get_db)):
    usuario = obtener_usuario_actual(request, db)
    productos = db.query(Producto).filter(Producto.ID_USER == usuario.ID).all()  # Solo los productos del usuario
    return productos

@app.get("/api/productos/{producto_id}")
def obtener_producto(producto_id: int, request: Request, db: Session = Depends(get_db)):
    usuario = obtener_usuario_actual(request, db)
    producto = db.query(Producto).filter(Producto.ID == producto_id, Producto.ID_USER == usuario.ID).first()

    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto

@app.put("/api/productos/{producto_id}")
def actualizar_producto(producto_id: int, producto: ProductoSchema, request: Request, db: Session = Depends(get_db)):
    usuario = obtener_usuario_actual(request, db)
    producto_existente = db.query(Producto).filter(Producto.ID == producto_id).first()

    if not producto_existente:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Verificar que el producto pertenece al usuario
    if producto_existente.ID_USER != usuario.ID:
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar este producto")

    for key, value in producto.dict().items():
        setattr(producto_existente, key, value)

    db.commit()
    return {"mensaje": "Producto actualizado exitosamente"}

@app.delete("/api/productos/{producto_id}")
def eliminar_producto(producto_id: int, request: Request, db: Session = Depends(get_db)):
    usuario = obtener_usuario_actual(request, db)
    producto = db.query(Producto).filter(Producto.ID == producto_id).first()

    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")


    if producto.ID_USER != usuario.ID:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar este producto")

    db.delete(producto)
    db.commit()
    return {"mensaje": "Producto eliminado exitosamente"}