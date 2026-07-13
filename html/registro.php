<?php
/* Registro de clientes nuevos. */
require __DIR__ . "/config.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") responder(["error" => "Método no permitido"], 405);

$b = cuerpo();
$nombre = trim($b["nombre"] ?? "");
$email = trim($b["email"] ?? "");
$telefono = trim($b["telefono"] ?? "");
$password = $b["password"] ?? "";

if ($nombre === "" || $email === "" || $telefono === "" || strlen($password) < 6) {
    responder(["error" => "Datos incompletos (la contraseña necesita al menos 6 caracteres)."], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    responder(["error" => "El correo no tiene un formato válido."], 400);
}

$cn = db();
$st = $cn->prepare("SELECT id FROM usuarios WHERE email = ?");
$st->bind_param("s", $email);
$st->execute();
if ($st->get_result()->fetch_assoc()) responder(["error" => "Ya existe una cuenta con ese correo."], 409);

$hash = password_hash($password, PASSWORD_DEFAULT);
$st = $cn->prepare("INSERT INTO usuarios (nombre, email, telefono, password_hash, rol) VALUES (?, ?, ?, ?, 'cliente')");
$st->bind_param("ssss", $nombre, $email, $telefono, $hash);
$st->execute();

responder(["usuario" => [
    "id" => $cn->insert_id, "nombre" => $nombre, "email" => $email,
    "telefono" => $telefono, "rol" => "cliente",
]]);
