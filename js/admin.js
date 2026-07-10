/* ============================================================
   SMART-BARBER — Panel de administración (js/admin.js)
   Dashboard, reservas, servicios, barberos, horarios,
   clientes y reportes.
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const sesion = Auth.requerir("admin");
  if (!sesion) return;
  await DB.init(); // detecta XAMPP (API) o usa respaldo local

  const $ = (id) => document.getElementById(id);
  const nombreCliente = (id) => DB.usuarioPorId(id)?.nombre || "Cliente eliminado";
  const telCliente = (id) => DB.usuarioPorId(id)?.telefono || "—";
  const nombreServicio = (id) => DB.servicioPorId(id)?.nombre || "—";
  const nombreBarbero = (id) => DB.barberoPorId(id)?.nombre || "—";
  const precioServicio = (id) => DB.servicioPorId(id)?.precio || 0;

  /* ---------- Navegación lateral ---------- */
  const pintores = {
    dashboard: pintarDashboard,
    reservas: pintarReservas,
    servicios: pintarServicios,
    barberos: pintarBarberos,
    horarios: pintarHorarios,
    clientes: pintarClientes,
    reportes: pintarReportes,
  };
  document.querySelectorAll(".side-link[data-seccion]").forEach((btn) => {
    btn.onclick = () => mostrarSeccion(btn.dataset.seccion);
  });
  function mostrarSeccion(nombre) {
    document.querySelectorAll(".seccion").forEach((s) => s.classList.add("hidden"));
    $("sec-" + nombre).classList.remove("hidden");
    document.querySelectorAll(".side-link[data-seccion]").forEach((b) =>
      b.classList.toggle("active", b.dataset.seccion === nombre));
    pintores[nombre]();
  }

  /* ============================================================
     DASHBOARD — KPIs y clientes del día
     ============================================================ */
  function pintarDashboard() {
    const hoy = DB.fechaISO();
    $("fechaHoy").textContent = "Hoy es " + DB.fechaBonita(hoy);
    $("saludoAdmin").textContent = "Sesión: " + sesion.nombre;

    const deHoy = DB.citasDeFecha(hoy);
    const activasHoy = deHoy.filter((c) => c.estado !== "cancelada");
    const ingresosHoy = deHoy
      .filter((c) => ["completada", "confirmada", "pendiente"].includes(c.estado))
      .reduce((sum, c) => sum + DB.precioTotal(c.servicioIds), 0);
    const pendientes = deHoy.filter((c) => c.estado === "pendiente").length;

    // Tasa de no-show de los últimos 30 días
    const desde = new Date(); desde.setDate(desde.getDate() - 30);
    const rango = DB.citas().filter((c) => c.fecha >= DB.fechaISO(desde) && c.fecha <= hoy);
    const finalizadas = rango.filter((c) => ["completada", "no-show"].includes(c.estado));
    const noShows = rango.filter((c) => c.estado === "no-show").length;
    const tasaNS = finalizadas.length ? Math.round((noShows / finalizadas.length) * 100) : 0;

    const totalClientes = DB.usuarios().filter((u) => u.rol === "cliente").length;

    $("kpisHoy").innerHTML = `
      <div class="kpi accent">
        <div class="kpi-label">Citas de hoy</div>
        <div class="kpi-value">${activasHoy.length}</div>
        <div class="kpi-note">${pendientes} por confirmar</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Ingresos estimados hoy</div>
        <div class="kpi-value">${DB.colones(ingresosHoy)}</div>
        <div class="kpi-note">Citas activas y completadas</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Tasa de no-show (30 días)</div>
        <div class="kpi-value">${tasaNS}%</div>
        <div class="kpi-note">${noShows} ausencias registradas</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Clientes registrados</div>
        <div class="kpi-value">${totalClientes}</div>
        <div class="kpi-note">Con cuenta en la plataforma</div>
      </div>`;

    const filas = deHoy.map((c) => `
      <tr>
        <td><b>${c.hora}</b></td>
        <td>${UI.esc(nombreCliente(c.clienteId))}</td>
        <td class="muted">${UI.esc(telCliente(c.clienteId))}</td>
        <td>${UI.esc(DB.nombresServicios(c.servicioIds))}</td>
        <td class="muted">${UI.esc(nombreBarbero(c.barberoId))}</td>
        <td>${UI.badgeEstado(c.estado)}</td>
        <td>${accionesCita(c)}</td>
      </tr>`).join("");
    $("tablaHoy").innerHTML = filas ||
      `<tr class="empty-row"><td colspan="7">No hay citas para hoy.</td></tr>`;
    conectarAccionesCita($("tablaHoy"), pintarDashboard);
  }

  /* Botones de acción según el estado actual de la cita */
  function accionesCita(c) {
    const b = (accion, texto, clase = "btn-ghost") =>
      `<button class="btn ${clase} btn-sm" data-accion="${accion}" data-id="${c.id}" type="button">${texto}</button>`;
    let html = '<div class="row-actions">';
    if (c.estado === "pendiente") html += b("confirmada", "✓ Confirmar", "btn-outline");
    if (["pendiente", "confirmada"].includes(c.estado)) {
      html += b("completada", "Completar");
      html += b("no-show", "No asistió");
      html += b("cancelada", "Cancelar", "btn-danger");
    }
    html += "</div>";
    return html;
  }

  function conectarAccionesCita(tabla, repintar) {
    tabla.querySelectorAll("[data-accion]").forEach((btn) => {
      btn.onclick = async () => {
        const { accion, id } = btn.dataset;
        if (accion === "cancelada") {
          const ok = await UI.confirmar("Se liberará el horario para otros clientes.",
            { titulo: "Cancelar cita", textoOk: "Sí, cancelar", peligro: true });
          if (!ok) return;
        }
        await DB.cambiarEstadoCita(id, accion);
        const c = DB.citaPorId(id);
        if (accion === "confirmada" && c) {
          UI.notificar("Correo/SMS", nombreCliente(c.clienteId),
            `Tu cita del ${DB.fechaBonita(c.fecha)} a las ${c.hora} fue confirmada.`);
        } else {
          UI.toast(`Cita marcada como "${UI.NOMBRE_ESTADO[accion]}".`, "ok");
        }
        repintar();
      };
    });
  }

  /* ============================================================
     RESERVAS — listado completo con filtros
     ============================================================ */
  function pintarReservas() {
    const f = $("filtroFecha").value;
    const e = $("filtroEstado").value;
    const lista = DB.citas()
      .filter((c) => (!f || c.fecha === f) && (!e || c.estado === e))
      .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))
      .slice(0, 120);

    $("tablaReservas").innerHTML = lista.map((c) => `
      <tr>
        <td>${c.fecha}</td>
        <td><b>${c.hora}</b></td>
        <td>${UI.esc(nombreCliente(c.clienteId))}</td>
        <td>${UI.esc(DB.nombresServicios(c.servicioIds))}</td>
        <td class="muted">${UI.esc(nombreBarbero(c.barberoId))}</td>
        <td>${UI.badgeEstado(c.estado)}</td>
        <td>${accionesCita(c)}</td>
      </tr>`).join("") ||
      `<tr class="empty-row"><td colspan="7">No hay reservas con esos filtros.</td></tr>`;
    conectarAccionesCita($("tablaReservas"), pintarReservas);
  }
  $("filtroFecha").onchange = pintarReservas;
  $("filtroEstado").onchange = pintarReservas;
  $("btnLimpiarFiltros").onclick = () => {
    $("filtroFecha").value = ""; $("filtroEstado").value = "";
    pintarReservas();
  };

  /* ============================================================
     SERVICIOS — CRUD
     ============================================================ */
  function pintarServicios() {
    $("tablaServicios").innerHTML = DB.servicios().map((s) => `
      <tr>
        <td><b>${UI.esc(s.nombre)}</b><br><span class="muted small">${UI.esc(s.descripcion || "")}</span></td>
        <td>${s.duracion} min</td>
        <td><b class="gold">${DB.colones(s.precio)}</b></td>
        <td>${s.activo ? '<span class="badge badge-confirmada">Activo</span>' : '<span class="badge badge-cancelada">Inactivo</span>'}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-outline btn-sm" data-editar="${s.id}" type="button">Editar</button>
            <button class="btn btn-ghost btn-sm" data-toggle="${s.id}" type="button">${s.activo ? "Desactivar" : "Activar"}</button>
            <button class="btn btn-danger btn-sm" data-borrar="${s.id}" type="button">Eliminar</button>
          </div>
        </td>
      </tr>`).join("");

    $("tablaServicios").querySelectorAll("[data-editar]").forEach((b) =>
      b.onclick = () => formServicio(DB.servicioPorId(b.dataset.editar)));
    $("tablaServicios").querySelectorAll("[data-toggle]").forEach((b) =>
      b.onclick = async () => {
        const s = DB.servicioPorId(b.dataset.toggle);
        await DB.guardarServicio({ ...s, activo: !s.activo });
        pintarServicios();
      });
    $("tablaServicios").querySelectorAll("[data-borrar]").forEach((b) =>
      b.onclick = async () => {
        const ok = await UI.confirmar("Las citas existentes de este servicio quedarán sin referencia. Considerá desactivarlo en su lugar.",
          { titulo: "Eliminar servicio", textoOk: "Eliminar de todos modos", peligro: true });
        if (!ok) return;
        await DB.eliminarServicio(b.dataset.borrar);
        UI.toast("Servicio eliminado.", "ok");
        pintarServicios();
      });
  }

  function formServicio(s = null) {
    const overlay = UI.modal(`
      <h3>${s ? "Editar" : "Nuevo"} servicio</h3>
      <form id="fSrv">
        <div class="form-group">
          <label>Nombre</label>
          <input class="form-control" id="fNombre" value="${UI.esc(s?.nombre || "")}" required>
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <input class="form-control" id="fDesc" value="${UI.esc(s?.descripcion || "")}">
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr">
          <div class="form-group">
            <label>Precio (₡)</label>
            <input class="form-control" type="number" id="fPrecio" min="0" step="500" value="${s?.precio ?? 5000}" required>
          </div>
          <div class="form-group">
            <label>Duración (min)</label>
            <select class="form-control" id="fDur">
              ${[15, 30, 45, 60, 90, 120].map((d) => `<option value="${d}" ${s?.duracion === d ? "selected" : ""}>${d} min</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" onclick="UI.cerrarModal()">Cancelar</button>
          <button class="btn btn-gold" type="submit">Guardar</button>
        </div>
      </form>`);
    overlay.querySelector("#fSrv").onsubmit = async (e) => {
      e.preventDefault();
      await DB.guardarServicio({
        id: s?.id,
        nombre: overlay.querySelector("#fNombre").value.trim(),
        descripcion: overlay.querySelector("#fDesc").value.trim(),
        precio: Number(overlay.querySelector("#fPrecio").value),
        duracion: Number(overlay.querySelector("#fDur").value),
        activo: s?.activo ?? true,
      });
      UI.cerrarModal();
      UI.toast("Servicio guardado.", "ok");
      pintarServicios();
    };
  }
  $("btnNuevoServicio").onclick = () => formServicio();

  /* ============================================================
     BARBEROS — CRUD
     ============================================================ */
  function pintarBarberos() {
    $("tablaBarberos").innerHTML = DB.barberos().map((b) => `
      <tr>
        <td><b>${UI.esc(b.nombre)}</b></td>
        <td class="muted">${UI.esc(b.especialidad || "")}</td>
        <td>${b.activo ? '<span class="badge badge-confirmada">Activo</span>' : '<span class="badge badge-cancelada">Inactivo</span>'}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-outline btn-sm" data-editar="${b.id}" type="button">Editar</button>
            <button class="btn btn-ghost btn-sm" data-toggle="${b.id}" type="button">${b.activo ? "Desactivar" : "Activar"}</button>
            <button class="btn btn-danger btn-sm" data-borrar="${b.id}" type="button">Eliminar</button>
          </div>
        </td>
      </tr>`).join("");

    $("tablaBarberos").querySelectorAll("[data-editar]").forEach((btn) =>
      btn.onclick = () => formBarbero(DB.barberoPorId(btn.dataset.editar)));
    $("tablaBarberos").querySelectorAll("[data-toggle]").forEach((btn) =>
      btn.onclick = async () => {
        const b = DB.barberoPorId(btn.dataset.toggle);
        await DB.guardarBarbero({ ...b, activo: !b.activo });
        pintarBarberos();
      });
    $("tablaBarberos").querySelectorAll("[data-borrar]").forEach((btn) =>
      btn.onclick = async () => {
        const ok = await UI.confirmar("¿Eliminar este barbero del personal?",
          { titulo: "Eliminar barbero", textoOk: "Eliminar", peligro: true });
        if (!ok) return;
        await DB.eliminarBarbero(btn.dataset.borrar);
        pintarBarberos();
      });
  }

  function formBarbero(b = null) {
    const overlay = UI.modal(`
      <h3>${b ? "Editar" : "Nuevo"} barbero</h3>
      <form id="fBar">
        <div class="form-group">
          <label>Nombre</label>
          <input class="form-control" id="fBNombre" value="${UI.esc(b?.nombre || "")}" required>
        </div>
        <div class="form-group">
          <label>Especialidad</label>
          <input class="form-control" id="fBEsp" value="${UI.esc(b?.especialidad || "")}" placeholder="Ej: Fades y diseño">
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" onclick="UI.cerrarModal()">Cancelar</button>
          <button class="btn btn-gold" type="submit">Guardar</button>
        </div>
      </form>`);
    overlay.querySelector("#fBar").onsubmit = async (e) => {
      e.preventDefault();
      await DB.guardarBarbero({
        id: b?.id,
        nombre: overlay.querySelector("#fBNombre").value.trim(),
        especialidad: overlay.querySelector("#fBEsp").value.trim(),
        activo: b?.activo ?? true,
      });
      UI.cerrarModal();
      UI.toast("Barbero guardado.", "ok");
      pintarBarberos();
    };
  }
  $("btnNuevoBarbero").onclick = () => formBarbero();

  /* ============================================================
     HORARIOS — configuración y bloqueos
     ============================================================ */
  function pintarHorarios() {
    const cfg = DB.config();
    $("cfgApertura").value = cfg.apertura;
    $("cfgCierre").value = cfg.cierre;
    $("cfgIntervalo").value = cfg.intervalo;

    $("gridDias").innerHTML = DB.DIAS.map((nombre, i) => `
      <label class="day-check">
        <input type="checkbox" value="${i}" ${(cfg.diasLaborales || []).includes(i) ? "checked" : ""}>
        <span>${nombre[0].toUpperCase() + nombre.slice(1, 3)}</span>
      </label>`).join("");

    const bloqueos = (cfg.bloqueos || []).sort();
    $("listaBloqueos").innerHTML = bloqueos.length
      ? bloqueos.map((f) => `
          <div class="flex-between" style="padding:0.5rem 0; border-bottom:1px solid var(--border);">
            <span>📅 ${DB.fechaBonita(f)}</span>
            <button class="btn btn-ghost btn-sm" data-quitar="${f}" type="button">Quitar</button>
          </div>`).join("")
      : '<p class="muted small">No hay fechas bloqueadas.</p>';

    $("listaBloqueos").querySelectorAll("[data-quitar]").forEach((b) =>
      b.onclick = async () => {
        await DB.guardarConfig({ bloqueos: bloqueos.filter((f) => f !== b.dataset.quitar) });
        pintarHorarios();
      });
  }

  $("formHorario").onsubmit = async (e) => {
    e.preventDefault();
    const apertura = $("cfgApertura").value;
    const cierre = $("cfgCierre").value;
    if (DB.aMin(cierre) <= DB.aMin(apertura))
      return UI.toast("La hora de cierre debe ser posterior a la apertura.", "error");
    const dias = [...$("gridDias").querySelectorAll("input:checked")].map((c) => Number(c.value));
    if (!dias.length) return UI.toast("Elegí al menos un día laboral.", "error");
    await DB.guardarConfig({ apertura, cierre, intervalo: Number($("cfgIntervalo").value), diasLaborales: dias });
    UI.toast("Horario actualizado.", "ok");
  };

  $("formBloqueo").onsubmit = async (e) => {
    e.preventDefault();
    const f = $("nuevaFechaBloqueo").value;
    if (!f) return;
    const cfg = DB.config();
    if ((cfg.bloqueos || []).includes(f)) return UI.toast("Esa fecha ya está bloqueada.", "error");
    await DB.guardarConfig({ bloqueos: [...(cfg.bloqueos || []), f] });
    $("nuevaFechaBloqueo").value = "";
    UI.toast("Fecha bloqueada. Los clientes no podrán reservar ese día.", "ok");
    pintarHorarios();
  };

  /* ============================================================
     CLIENTES — historial
     ============================================================ */
  function pintarClientes() {
    const clientes = DB.usuarios().filter((u) => u.rol === "cliente");
    $("tablaClientes").innerHTML = clientes.map((u) => {
      const citas = DB.citasDeCliente(u.id);
      const visitas = citas.filter((c) => c.estado === "completada");
      const ns = citas.filter((c) => c.estado === "no-show").length;
      const ultima = visitas[0]?.fecha;
      return `
        <tr>
          <td><b>${UI.esc(u.nombre)}</b></td>
          <td class="muted">${UI.esc(u.email)}<br>${UI.esc(u.telefono || "")}</td>
          <td><b>${visitas.length}</b></td>
          <td class="muted">${ultima ? DB.fechaBonita(ultima) : "—"}</td>
          <td>${ns > 0 ? `<span class="badge badge-noshow">${ns}</span>` : '<span class="muted">0</span>'}</td>
          <td><button class="btn btn-outline btn-sm" data-hist="${u.id}" type="button">Ver historial</button></td>
        </tr>`;
    }).join("") || `<tr class="empty-row"><td colspan="6">Aún no hay clientes registrados.</td></tr>`;

    $("tablaClientes").querySelectorAll("[data-hist]").forEach((b) =>
      b.onclick = () => {
        const u = DB.usuarioPorId(b.dataset.hist);
        const citas = DB.citasDeCliente(u.id).slice(0, 15);
        UI.modal(`
          <h3>Historial de ${UI.esc(u.nombre)}</h3>
          <div class="table-wrap">
            <table class="data-table" style="min-width:0">
              <thead><tr><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Estado</th></tr></thead>
              <tbody>
                ${citas.map((c) => `
                  <tr>
                    <td>${c.fecha}</td><td>${c.hora}</td>
                    <td>${UI.esc(DB.nombresServicios(c.servicioIds))}</td>
                    <td>${UI.badgeEstado(c.estado)}</td>
                  </tr>`).join("") || '<tr class="empty-row"><td colspan="4">Sin citas.</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="modal-actions">
            <button class="btn btn-gold" onclick="UI.cerrarModal()" type="button">Cerrar</button>
          </div>`);
      });
  }

  /* ============================================================
     REPORTES — últimos 30 días
     ============================================================ */
  function pintarReportes() {
    const hoy = DB.fechaISO();
    const desde = new Date(); desde.setDate(desde.getDate() - 30);
    const rango = DB.citas().filter((c) => c.fecha >= DB.fechaISO(desde) && c.fecha <= hoy);
    const validas = rango.filter((c) => c.estado !== "cancelada");
    const completadas = rango.filter((c) => c.estado === "completada");
    const noShows = rango.filter((c) => c.estado === "no-show");
    const ingresos = completadas.reduce((s, c) => s + DB.precioTotal(c.servicioIds), 0);
    const finalizadas = completadas.length + noShows.length;
    const tasaNS = finalizadas ? Math.round((noShows.length / finalizadas) * 100) : 0;

    $("kpisMes").innerHTML = `
      <div class="kpi accent">
        <div class="kpi-label">Citas del período</div>
        <div class="kpi-value">${validas.length}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Ingresos (completadas)</div>
        <div class="kpi-value">${DB.colones(ingresos)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Tasa de no-show</div>
        <div class="kpi-value">${tasaNS}%</div>
        <div class="kpi-note">${noShows.length} de ${finalizadas} citas finalizadas</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Canceladas</div>
        <div class="kpi-value">${rango.length - validas.length}</div>
      </div>`;

    /* --- Servicios más solicitados (barras horizontales) --- */
    const porServicio = {};
    validas.forEach((c) => (c.servicioIds || []).forEach((id) => {
      porServicio[id] = (porServicio[id] || 0) + 1;
    }));
    const topServicios = Object.entries(porServicio)
      .map(([id, n]) => ({ nombre: nombreServicio(id), n }))
      .sort((a, b) => b.n - a.n).slice(0, 6);
    const maxS = Math.max(...topServicios.map((s) => s.n), 1);
    $("chartServicios").innerHTML = topServicios.map((s) => `
      <div class="bar-row" title="${UI.esc(s.nombre)}: ${s.n} citas">
        <span class="bar-label">${UI.esc(s.nombre)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(s.n / maxS) * 100}%"></div></div>
        <span class="bar-value">${s.n}</span>
      </div>`).join("") || '<p class="muted small">Sin datos en el período.</p>';

    /* --- Horas pico (barras verticales) --- */
    const porHora = {};
    validas.forEach((c) => { const h = c.hora.slice(0, 2) + ":00"; porHora[h] = (porHora[h] || 0) + 1; });
    const horas = Object.keys(porHora).sort();
    const maxH = Math.max(...Object.values(porHora), 1);
    $("chartHoras").innerHTML = horas.map((h) => `
      <div class="vbar" title="${h}: ${porHora[h]} citas">
        <span class="vbar-v">${porHora[h]}</span>
        <div class="vbar-fill" style="height:${(porHora[h] / maxH) * 100}%"></div>
        <span class="vbar-x">${h.slice(0, 2)}h</span>
      </div>`).join("") || '<p class="muted small">Sin datos en el período.</p>';

    /* --- Ocupación por día de semana --- */
    const porDia = {};
    validas.forEach((c) => {
      const [y, m, d] = c.fecha.split("-").map(Number);
      const dia = new Date(y, m - 1, d).getDay();
      porDia[dia] = (porDia[dia] || 0) + 1;
    });
    const diasOrden = [1, 2, 3, 4, 5, 6, 0].filter((d) => porDia[d]);
    const maxD = Math.max(...Object.values(porDia), 1);
    $("chartDias").innerHTML = diasOrden.map((d) => `
      <div class="bar-row" title="${DB.DIAS[d]}: ${porDia[d]} citas">
        <span class="bar-label">${DB.DIAS[d][0].toUpperCase() + DB.DIAS[d].slice(1)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(porDia[d] / maxD) * 100}%"></div></div>
        <span class="bar-value">${porDia[d]}</span>
      </div>`).join("");

    /* --- Tabla resumen (vista accesible de los gráficos) --- */
    const horaPico = horas.sort((a, b) => porHora[b] - porHora[a])[0];
    const diaTop = diasOrden.sort((a, b) => porDia[b] - porDia[a])[0];
    const diaBajo = [...diasOrden].sort((a, b) => porDia[a] - porDia[b])[0];
    $("tablaResumenReportes").innerHTML = `
      <tr><td>Servicio más solicitado</td><td><b>${UI.esc(topServicios[0]?.nombre || "—")}</b> (${topServicios[0]?.n || 0} citas)</td></tr>
      <tr><td>Hora pico</td><td><b>${horaPico || "—"}</b> (${porHora[horaPico] || 0} citas)</td></tr>
      <tr><td>Día de mayor demanda</td><td><b>${diaTop != null ? DB.DIAS[diaTop] : "—"}</b> (${porDia[diaTop] || 0} citas)</td></tr>
      <tr><td>Día de menor ocupación</td><td><b>${diaBajo != null ? DB.DIAS[diaBajo] : "—"}</b> (${porDia[diaBajo] || 0} citas)</td></tr>
      <tr><td>Citas completadas</td><td><b>${completadas.length}</b></td></tr>
      <tr><td>Ingresos del período</td><td><b>${DB.colones(ingresos)}</b></td></tr>`;
  }

  /* ---------- Arranque ---------- */
  pintarDashboard();
});
