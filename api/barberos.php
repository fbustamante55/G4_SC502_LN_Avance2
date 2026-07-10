<?php
/* CRUD de barberos/personal (POST crea/actualiza, DELETE elimina). */
require __DIR__ . "/config.php";
$cn = db();
$metodo = $_SERVER["REQUEST_METHOD"];

if ($metodo === "GET") responder(["barberos" => tabla_barberos($cn)]);

if ($metodo === "DELETE") {
    $id = (int)($_GET["id"] ?? 0);
    if (!$id) responder(["error" => "Falta el id."], 400);
    $cn->query("DELETE FROM barberos WHERE id = $id");
    responder(["barberos" => tabla_barberos($cn)]);
}

if ($metodo !== "POST") responder(["error" => "Método no permitido"], 405);

$b = cuerpo();
$nombre = trim($b["nombre"] ?? "");
$especialidad = trim($b["especialidad"] ?? "");
$activo = !empty($b["activo"]) ? 1 : 0;
$id = (int)($b["id"] ?? 0);

if ($nombre === "") responder(["error" => "El nombre es obligatorio."], 400);

if ($id) {
    $st = $cn->prepare("UPDATE barberos SET nombre=?, especialidad=?, activo=? WHERE id=?");
    $st->bind_param("ssii", $nombre, $especialidad, $activo, $id);
} else {
    $st = $cn->prepare("INSERT INTO barberos (nombre, especialidad, activo) VALUES (?, ?, ?)");
    $st->bind_param("ssi", $nombre, $especialidad, $activo);
}
$st->execute();
responder(["barberos" => tabla_barberos($cn)]);
