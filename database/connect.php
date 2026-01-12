<?php
// database/connect.php
// Este archivo ahora usa la configuración centralizada
// Para mantener compatibilidad, redirigimos a config/database.php

require_once __DIR__ . '/../config/database.php';

// La conexión ya está creada en config/database.php y disponible en $GLOBALS['conn']
$conn = $GLOBALS['conn'];
?>