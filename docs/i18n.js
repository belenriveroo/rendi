// Rendí · idioma de la app
// La app está escrita en español. Para quien rinde desde Brasil se muestra en portugués:
// este módulo mira cada texto que aparece en la pantalla y lo cambia por su traducción
// (textos fijos con el diccionario, textos con números o nombres con patrones).
// Los datos que carga la persona (comercios, títulos, justificaciones) no se traducen.

const PT = {
  // ---------- menú, encabezados y navegación
  "Inicio": "Início", "Nueva": "Novo", "Nueva rendición": "Novo relatório", "Mis gastos": "Minhas despesas",
  "Mis rendiciones": "Meus relatórios", "Rendiciones": "Relatórios", "Rendición": "Relatório", "Más": "Mais",
  "Mi perfil": "Meu perfil", "Mis datos": "Meus dados", "Sesión": "Sessão", "Cerrar sesión": "Sair",
  "Cerrás la sesión en este dispositivo.": "Você sai da conta neste dispositivo.",
  "Menú principal": "Menu principal", "Abrir el menú": "Abrir o menu", "Plegar menú": "Recolher menu",
  "Plegar o desplegar el menú": "Recolher ou expandir o menu", "Accesos rápidos": "Atalhos",
  "Saltar al contenido": "Pular para o conteúdo", "Volver arriba": "Voltar ao topo", "Volver al inicio": "Voltar ao início",
  "Cambiar entre modo claro y oscuro": "Alternar entre modo claro e escuro", "Ver todas ›": "Ver todos ›", "Ver todas": "Ver todos",
  "Últimas rendiciones": "Últimos relatórios", "Ver las mías": "Ver os meus", "Calidad": "Qualidade", "Control de calidad": "Controle de qualidade",
  "Mi equipo": "Minha equipe", "Por aprobar": "Para aprovar", "Aprobar": "Aprovar", "Gastos": "Despesas", "Finanzas": "Financeiro",
  "Historial": "Histórico", "Totales": "Totais", "Usuarios": "Usuários", "Administración": "Administração",
  "Todas las rendiciones": "Todos os relatórios", "Monedas y topes": "Moedas e limites", "Revisión Finanzas": "Revisão do Financeiro",
  "A reembolsar": "A reembolsar", "Rendiciones del equipo": "Relatórios da equipe",

  // ---------- estados y filtros
  "Todas": "Todos", "Borrador": "Rascunho", "Borradores": "Rascunhos", "Pendiente": "Pendente", "Pendientes": "Pendentes",
  "Pendiente jefe": "Aguardando gestor", "En Finanzas": "No Financeiro", "Devuelta": "Devolvido", "Devueltas": "Devolvidos",
  "Devuelta para corregir": "Devolvido para correção", "Aprobada": "Aprovado", "Aprobadas": "Aprovados", "Aprobada parcial": "Aprovado em parte",
  "Reembolsada": "Reembolsado", "Reembolsadas": "Reembolsados", "Rechazada": "Recusado", "Rechazadas": "Recusados",
  "Aprobado": "Aprovado", "Aprobado parcial": "Aprovado em parte", "aprobado parcial": "aprovado em parte", "aprobado": "aprovado",
  "Rechazado": "Recusado", "A corregir": "A corrigir", "No reconocido": "Não reconhecido", "Jefe": "Gestor",
  "Filtrar por estado": "Filtrar por status", "Estado": "Status", "Estado de la rendición": "Status do relatório",
  "Estado rendición": "Status do relatório", "Estado ticket": "Status do comprovante", "Recibido": "Recebido", "Sin confirmar": "Não confirmado",

  // ---------- inicio
  "Todo al día.": "Tudo em dia.", "Te reembolsaron": "Você recebeu", "Crear la primera": "Criar o primeiro",
  "Todavía no tenés rendiciones.": "Você ainda não tem relatórios.", "Todavía no hay rendiciones.": "Ainda não há relatórios.",
  "No hay rendiciones en este estado.": "Não há relatórios neste status.", "Buscar rendiciones": "Buscar relatórios",
  "Buscar por nombre, persona o estado": "Buscar por nome, pessoa ou status", "No hay nada esperando.": "Nada aguardando.",
  "Esperan tu aprobación": "Aguardam sua aprovação", "Tu equipo espera tu aprobación": "Sua equipe aguarda sua aprovação",
  "Monto por aprobar": "Valor para aprovar", "No tenés nada pendiente de aprobar.": "Você não tem nada pendente para aprovar.",

  // ---------- nueva rendición
  "¿Qué vas a rendir?": "O que você vai prestar contas?", "Nombre de la rendición": "Nome do relatório",
  "Ej.: Viaje a Salto · visita a cliente": "Ex.: Viagem a Campinas · visita a cliente", "Crear y agregar tickets": "Criar e adicionar comprovantes",
  "Rendición creada": "Relatório criado",

  // ---------- detalle de la rendición
  "Agregar tickets": "Adicionar comprovantes", "Agregá al menos un ticket.": "Adicione pelo menos um comprovante.",
  "Sacale foto o elegí varias de la galería. La IA lee cada ticket y vos revisás antes de guardar.": "Tire uma foto ou escolha várias da galeria. A IA lê cada comprovante e você revisa antes de salvar.",
  "o cargar un ticket a mano": "ou lançar um comprovante manualmente", "Carga manual": "Lançamento manual",
  "Total de los tickets": "Total dos comprovantes", "A reembolsar (sin lo personal)": "A reembolsar (sem o pessoal)",
  "Aprobado para reembolsar": "Aprovado para reembolso", "Rinde": "Quem presta contas", "Esta rendición no tiene tickets.": "Este relatório não tem comprovantes.",
  "Eliminar borrador": "Excluir rascunho", "Eliminar": "Excluir", "Enviar": "Enviar", "Enviar a mi jefe": "Enviar ao meu gestor",
  "Enviar a Finanzas": "Enviar ao Financeiro", "Todo listo para enviar.": "Tudo pronto para enviar.",
  "Hay datos que bloquean el envío: corregilos.": "Há dados que impedem o envio: corrija-os.",
  "Escribí la justificación en los tickets marcados.": "Escreva a justificativa nos comprovantes marcados.",
  "Tu jefe pidió corregir algunos tickets. Mirá los comentarios abajo, corregí y volvé a enviar.": "Seu gestor pediu para corrigir alguns comprovantes. Veja os comentários abaixo, corrija e envie de novo.",
  "Historial y comentarios": "Histórico e comentários", "Todavía no hay movimientos.": "Ainda não há movimentações.",
  "Escribí un comentario": "Escreva um comentário", "Comentario": "Comentário", "Comentar": "Comentar", "Comentario agregado": "Comentário adicionado",
  "Decisión:": "Decisão:", "Descargar": "Baixar", "Excel (.xlsx)": "Excel (.xlsx)", "Preparando la descarga…": "Preparando o download…",
  "No hay nada para descargar.": "Não há nada para baixar.", "¡Listo! Rendición cerrada": "Pronto! Relatório encerrado",
  "No encontré esa rendición o no tenés permiso para verla.": "Não encontrei esse relatório ou você não tem permissão para vê-lo.",
  "Reembolso pagado": "Reembolso pago", "Registró": "Registrado por", "Monto": "Valor", "N.º de comprobante": "N.º do comprovante",
  "Ver comprobante de la transferencia": "Ver comprovante da transferência", "Confirmar que lo recibí": "Confirmar que recebi",
  "¿Ya te llegó la plata? Confirmalo para cerrar la rendición.": "O dinheiro já caiu? Confirme para encerrar o relatório.",
  "Se marcó como pagada antes de que la app pidiera los datos del pago.": "Foi marcado como pago antes de o app pedir os dados do pagamento.",
  "Pagado el": "Pago em",

  // ---------- tarjeta de cada ticket
  "Ver factura": "Ver nota", "Sin foto": "Sem foto", "Sin comercio": "Sem estabelecimento", "Sin líneas": "Sem itens", "Sin datos": "Sem dados",
  "Sin alertas automáticas.": "Sem alertas automáticos.", "Sin alertas automáticas": "Sem alertas automáticos",
  "Sin comprobante fiscal": "Sem nota fiscal", "Sin comprobante fiscal.": "Sem nota fiscal.", "Alcohol": "Álcool", "Alcohol.": "Álcool.",
  "Alcohol · no se reembolsa": "Álcool · não é reembolsado", "Personal": "Pessoal", "Corregir ticket": "Corrigir comprovante",
  "Corregir datos": "Corrigir dados", "Borrar ticket": "Excluir comprovante", "Guardar justificación": "Salvar justificativa",
  "Justificación": "Justificativa", "Justificado": "Justificado", "Justificar": "Justificar", "Justificación guardada": "Justificativa salva",
  "Corregido a mano": "Corrigido manualmente", "Se reembolsa": "Reembolsado", "Línea": "Item", "Importe": "Valor",
  "no coincide con el total": "não bate com o total", "Pago": "Pagamento", "Pix": "Pix", "Factura": "Nota", "Abrí": "Abra",
  "Abrir la imagen original": "Abrir a imagem original", "Acercar": "Aproximar", "Alejar": "Afastar", "Girar": "Girar", "Cerrar": "Fechar",
  "Bloquea": "Bloqueia", "Atención": "Atenção", "Info": "Info", "OK": "OK", "Ojo": "Atenção",

  // ---------- formulario del ticket
  "Revisá lo que leyó la IA": "Revise o que a IA leu", "La IA está leyendo el ticket…": "A IA está lendo o comprovante…",
  "Busca el tipo de comprobante, la moneda, el número de empresa, la fecha, el comercio, los montos, el IVA y cada línea.": "Busca o tipo de comprovante, a moeda, o CNPJ, a data, o estabelecimento, os valores, os impostos e cada item.",
  "Reintentar lectura": "Tentar ler de novo", "Reintentar": "Tentar de novo", "Tipo de comprobante": "Tipo de comprovante",
  "Comprobante fiscal": "Nota fiscal", "Nota fiscal": "Nota fiscal", "Comprovante Pix": "Comprovante Pix", "Comprobante del POS": "Comprovante da maquininha",
  "Comprobante de pago": "Comprovante de pagamento", "Comprobante de tarjeta": "Comprovante de cartão",
  "Comprobante": "Comprovante", "Moneda": "Moeda", "Comercio": "Estabelecimento", "Fecha": "Data", "Categoría": "Categoria",
  "Medio de pago": "Meio de pagamento", "Medio": "Meio", "N.º de operación": "N.º da operação", "ID de la transacción": "ID da transação",
  "Mercado Pago, Prex, OCA…": "Mercado Pago, cartão, maquininha…", "Serie": "Série", "Número": "Número", "Serie y número": "Série e número",
  "Neto (sin IVA)": "Valor sem impostos", "Neto": "Valor sem impostos", "IVA": "Impostos", "Total": "Total",
  "Comidas": "Refeições", "Traslados": "Transporte", "Alojamiento": "Hospedagem", "Otros": "Outros",
  "+ Agregar línea": "+ Adicionar item", "Quitar": "Remover", "Quitar línea": "Remover item", "Quitar esta línea": "Remover este item",
  "Las líneas suman": "Os itens somam",
  "Justificación (si se pasa del tope, algo no cierra o no hay comprobante fiscal)": "Justificativa (se passar do limite, algo não bater ou não houver nota fiscal)",
  "Guardar ticket": "Salvar comprovante", "Descartar": "Descartar", "Ticket guardado": "Comprovante salvo", "Ticket borrado": "Comprovante excluído",
  "Ticket subido": "Comprovante enviado", "a mano": "manualmente", "· verificá los datos contra la foto": "· confira os dados com a foto",
  "Factura o ticket fiscal": "Nota fiscal ou cupom fiscal", "Boleta o factura": "Boleta ou nota", "Receipt o invoice": "Recibo ou invoice",
  "El comprovante Pix prueba que pagaste, pero no es una nota fiscal. Se puede rendir explicando por qué no hay nota fiscal.": "O comprovante Pix prova que você pagou, mas não é uma nota fiscal. Dá para prestar contas explicando por que não há nota fiscal.",
  "Se cortó la conexión con el lector de tickets (puede ser la señal del celular o que la IA tardó demasiado)": "A conexão com o leitor de comprovantes caiu (pode ser o sinal do celular ou a IA demorou demais)",

  // ---------- perfil
  "Nombre": "Nome", "Email": "E-mail", "Rol": "Função", "País y moneda": "País e moeda", "Área": "Área",
  "El rol, el jefe y el país los asigna el administrador.": "A função, o gestor e o país são definidos pelo administrador.",
  "Cambiar foto": "Trocar foto", "Foto actualizada": "Foto atualizada", "Guardar cambios": "Salvar alterações", "Guardar": "Salvar",
  "Datos guardados": "Dados salvos", "Cambiar contraseña": "Alterar senha", "Contraseña nueva": "Nova senha", "Nueva contraseña": "Nova senha",
  "Repetila": "Repita", "Contraseña actualizada": "Senha atualizada", "Idioma": "Idioma",
  "La contraseña tiene que tener al menos 6 caracteres.": "A senha precisa ter pelo menos 6 caracteres.",
  "Las dos contraseñas no coinciden.": "As duas senhas não coincidem.",
  "Empleado/a": "Colaborador(a)", "Uruguay": "Uruguai", "Brasil": "Brasil", "Argentina": "Argentina", "Chile": "Chile", "Estados Unidos": "Estados Unidos",

  // ---------- diálogos y avisos
  "Confirmar": "Confirmar", "Cancelar": "Cancelar", "Sí, lo recibí": "Sim, recebi", "Algo falló": "Algo deu errado",
  "¿Confirmás que ya recibiste el pago de este reembolso?": "Você confirma que já recebeu o pagamento deste reembolso?",
  "¿Borrar este ticket? La foto queda guardada, pero el ticket sale de la rendición.": "Excluir este comprovante? A foto fica guardada, mas o comprovante sai do relatório.",
  "Borrador eliminado": "Rascunho excluído", "Seleccionar": "Selecionar", "Seleccionar todo": "Selecionar tudo",
  "Seleccionar borradores": "Selecionar rascunhos", "0 seleccionados": "0 selecionados",
  "Deslizá un borrador hacia la izquierda para eliminarlo.": "Deslize um rascunho para a esquerda para excluí-lo.",
  "Tu cuenta está pendiente de aprobación": "Sua conta está aguardando aprovação", "Tu solicitud no fue aprobada": "Sua solicitação não foi aprovada",
  "Permití las ventanas emergentes para descargar el PDF.": "Permita as janelas pop-up para baixar o PDF.", "Guardar como PDF": "Salvar como PDF",

  // ---------- reglas (etiquetas de las alertas)
  "Datos incompletos": "Dados incompletos", "Suma de líneas": "Soma dos itens", "Posible duplicado": "Possível duplicidade",
  "Tope por categoría": "Limite por categoria", "Tope mensual": "Limite mensal", "Fuera de plazo": "Fora do prazo",
  "Lectura dudosa": "Leitura duvidosa", "Pago repetido": "Pagamento repetido", "Pix repetido": "Pix repetido",

  // ---------- descargas (Excel / PDF / CSV)
  "Persona": "Pessoa", "Equivale en $U": "Equivale em $U", "Descargado por": "Baixado por",
  "Total en $U": "Total em $U",
  "Peso uruguayo": "Peso uruguaio", "Peso argentino": "Peso argentino", "Peso chileno": "Peso chileno", "Real brasileño": "Real brasileiro",
  "Dólar estadounidense": "Dólar americano", "Número o folio": "Número da nota", "si figura": "se constar",
  "Sacar foto o elegir tickets": "Tirar foto ou escolher comprovantes", "Confirmé que recibí el pago.": "Confirmei que recebi o pagamento.",
  "Corregido a mano.": "Corrigido manualmente.", "Corregido a mano": "Corrigido manualmente", "Justificación (opcional)": "Justificativa (opcional)",
  "· necesaria para enviar": "· necessária para enviar", "Motivo obligatorio": "Motivo obrigatório", "pidió corrección": "pediu correção", "rechazado": "recusado", "Pagado el": "Pago em", "Historial": "Histórico", "Mis rendiciones · Todas": "Meus relatórios · Todos",

  // ---------- errores de la base que puede ver quien rinde
  "Ponele un nombre a la rendición (por ejemplo: Viaje a Salto).": "Dê um nome ao relatório (por exemplo: Viagem a Campinas).",
  "Faltan datos básicos del ticket (comercio, fecha o total).": "Faltam dados básicos do comprovante (estabelecimento, data ou total).",
  "La fecha del ticket es futura. Revisá la lectura.": "A data do comprovante está no futuro. Revise a leitura.",
  "Hay otro ticket del mismo comercio, con la misma fecha y el mismo total. Si no es un duplicado, explicá por qué.": "Há outro comprovante do mesmo estabelecimento, com a mesma data e o mesmo total. Se não for duplicado, explique por quê.",
  "Es un comprobante de Pix: prueba que se pagó, pero no es una nota fiscal. Explicá por qué no hay nota fiscal (por ejemplo, un pago chico a una persona).": "É um comprovante de Pix: prova que foi pago, mas não é uma nota fiscal. Explique por que não há nota fiscal (por exemplo, um pagamento pequeno a uma pessoa física).",
  "Hay tickets con datos que bloquean el envío (faltan datos o la fecha es futura). Corregilos antes de enviar.": "Há comprovantes com dados que impedem o envio (faltam dados ou a data está no futuro). Corrija antes de enviar.",
  "Hay tickets que necesitan justificación. Escribila en cada uno para poder enviar.": "Há comprovantes que precisam de justificativa. Escreva em cada um para poder enviar.",
  "No hay tickets para enviar.": "Não há comprovantes para enviar.", "Esta rendición no se puede enviar.": "Este relatório não pode ser enviado.",
  "Esta rendición ya no se puede modificar.": "Este relatório não pode mais ser alterado.", "Este ticket ya no se puede modificar.": "Este comprovante não pode mais ser alterado.",
  "Este ticket ya no se puede borrar.": "Este comprovante não pode mais ser excluído.", "La foto no es tuya.": "A foto não é sua.",
  "Las bebidas alcohólicas nunca se reembolsan: esa línea queda como personal.": "Bebidas alcoólicas nunca são reembolsadas: esse item fica como pessoal.",
  "No podés comentar en esta rendición.": "Você não pode comentar neste relatório.", "El comentario está vacío.": "O comentário está vazio.",
  "Solo se pueden eliminar tus rendiciones en borrador.": "Só é possível excluir seus relatórios em rascunho.",
  "No hay un pago para confirmar en esta rendición.": "Não há pagamento para confirmar neste relatório.",
  "Tu cuenta todavía no está activa: la tiene que aprobar el administrador.": "Sua conta ainda não está ativa: o administrador precisa aprová-la.",
  "Tenés que iniciar sesión.": "Você precisa entrar na sua conta.", "Escribí tu nombre.": "Escreva seu nome.",
  "La foto no parece un comprobante. Probá con otra.": "A foto não parece um comprovante. Tente outra.",
  "Esa foto no es tuya.": "Essa foto não é sua.", "No encontré la foto.": "Não encontrei a foto.",
  "La IA tardó demasiado en responder. Probá de nuevo en un rato o cargalo a mano.": "A IA demorou demais para responder. Tente de novo daqui a pouco ou lance manualmente.",
};

const GRUPO = { todas: "todos", borradores: "em rascunho", pendientes: "pendentes", devueltas: "devolvidos", aprobadas: "aprovados", reembolsadas: "reembolsados", rechazadas: "recusados" };
const MESES = { ene: "jan", feb: "fev", mar: "mar", abr: "abr", may: "mai", jun: "jun", jul: "jul", ago: "ago", sep: "set", sept: "set", set: "set", oct: "out", nov: "nov", dic: "dez" };
const plural = (n, uno, varios) => `${n} ${Number(n) === 1 ? uno : varios}`;

// Textos que llevan números, montos o nombres
const PATRONES = [
  [/^Hola, (.+)$/, (m, n) => `Olá, ${n}`],
  [/^(\d+) corregidos? a mano$/, (m, n) => `${n} ${n === "1" ? "corrigido" : "corrigidos"} manualmente`],
  [/^(Eliminar|Seleccionar) (.+)$/, (m, v, x) => `${v === "Eliminar" ? "Excluir" : "Selecionar"} ${x}`],
  [/^en el ticket de (.+)$/, (m, x) => `no comprovante de ${x}`],
  [/^Reembolso pagado el (.+?) por (.+) · comprobante (.+)\.$/, (m, f, me, c) => `Reembolso pago em ${f} via ${me} · comprovante ${c}.`],
  [/^Un comprobante de pago \(POS, Prex, Mercado Pago\) no es un comprobante fiscal\. Se puede rendir, pero vas a tener que explicar por qué no hay (.+?)\.(.*)$/s,
    () => "Um comprovante de pagamento (maquininha, Mercado Pago) não é um comprovante fiscal. Dá para prestar contas, mas você vai ter que explicar por que não há nota fiscal. Se puder, peça ao estabelecimento."],
  [/^(\d+) tickets?$/, (m, n) => plural(n, "comprovante", "comprovantes")],
  [/^(\d+) sin foto$/, (m, n) => `${n} sem foto`],
  [/^(\d+) con excepción justificada$/, (m, n) => `${n} com exceção justificada`],
  [/^(\d+) con lectura dudosa$/, (m, n) => `${n} com leitura duvidosa`],
  [/^(\d+) seleccionados?$/, (m, n) => plural(n, "selecionado", "selecionados")],
  [/^No tenés rendiciones (\S+)\.$/, (m, g) => `Você não tem relatórios ${GRUPO[g] || g}.`],
  [/^Mis rendiciones ([^\s·]+)$/, (m, g) => `Meus relatórios ${GRUPO[g] || g}`],
  [/^creada (.+)$/, (m, f) => `criado em ${f}`],
  [/^enviada (.+)$/, (m, f) => `enviado em ${f}`],
  [/^pagado (.+)$/, (m, f) => `pago em ${f}`],
  [/^recibido ✓$/, () => "recebido ✓"],
  [/^a reembolsar (.+)$/, (m, x) => `a reembolsar ${x}`],
  [/^Rendís en (.+?) \((\w+)\)$/, (m, p, mon) => `Você presta contas no ${tr(p)} (${mon})`],
  [/^Justificación: (“.*”)$/s, (m, j) => `Justificativa: ${j}`],
  [/^Justificación: (.*)$/s, (m, j) => `Justificativa: ${j}`],
  [/^(.+) confirmó que lo recibió el (.+)\.$/, (m, q, f) => `${q} confirmou o recebimento em ${f}.`],
  [/^(.+) todavía no confirmó que recibió el pago\.$/, (m, q) => `${q} ainda não confirmou o recebimento.`],
  [/^Tus propios gastos: (\d+) rendici(?:ón|ones)(?:, (\d+) en borrador)?$/, (m, n, b) => `Suas despesas: ${plural(n, "relatório", "relatórios")}${b ? `, ${b} em rascunho` : ""}`],
  [/^Tu jefe te devolvió (\d+) rendici(?:ón|ones) para corregir\.$/, (m, n) => `Seu gestor devolveu ${plural(n, "relatório", "relatórios")} para correção.`],
  [/^Finanzas te pagó (\d+) rendici(?:ón|ones): confirmá que lo recibiste\.$/, (m, n) => `O Financeiro pagou ${plural(n, "relatório", "relatórios")}: confirme que recebeu.`],
  [/^Tenés (\d+) borrador(?:es)? sin enviar\.$/, (m, n) => `Você tem ${plural(n, "rascunho", "rascunhos")} sem enviar.`],
  [/^Tenés (\d+) rendici(?:ón|ones) esperando tu aprobación\.$/, (m, n) => `Você tem ${plural(n, "relatório", "relatórios")} aguardando sua aprovação.`],
  [/^Agrupá en una rendición los tickets de un viaje o de una actividad\. En el paso siguiente les sacás foto\. Cuando la envíes, va a (.+)\.$/,
    (m, d) => `Agrupe num relatório os comprovantes de uma viagem ou atividade. No próximo passo você tira as fotos. Quando enviar, ele vai para ${d === "tu jefe" ? "o seu gestor" : "o Financeiro (você não tem gestor)"}.`],
  [/^¿Enviar la rendición a (.+)\? Mientras la revisa no la vas a poder modificar\.$/,
    (m, a) => `Enviar o relatório para ${a === "tu jefe" ? "o seu gestor" : a === "Finanzas" ? "o Financeiro" : a}? Enquanto estiver em revisão, você não poderá alterá-lo.`],
  [/^Enviar a (tu jefe|mi jefe|Finanzas)$/, (m, a) => a === "Finanzas" ? "Enviar ao Financeiro" : "Enviar ao meu gestor"],
  [/^¿Eliminar el borrador «(.+)»\? Se borran sus tickets y fotos\. No se puede deshacer\.$/s,
    (m, t) => `Excluir o rascunho «${t}»? Os comprovantes e fotos dele serão apagados. Não dá para desfazer.`],
  [/^¿Eliminar (\d+) borradores?\? Se borran sus tickets y fotos\. No se puede deshacer\.$/,
    (m, n) => `Excluir ${plural(n, "rascunho", "rascunhos")}? Os comprovantes e fotos serão apagados. Não dá para desfazer.`],
  [/^(\d+) borradores eliminados$/, (m, n) => `${n} rascunhos excluídos`],
  [/^No se pudo leer automáticamente: (.+)\. Tocá «Reintentar lectura» o completalo a mano\.$/s,
    (m, e) => `Não foi possível ler automaticamente: ${tr(e)}. Toque em «Tentar ler de novo» ou preencha manualmente.`],
  [/^No se pudo subir la foto \((.+)\)\. Revisá la conexión y volvé a elegirla, o completalo a mano\.$/s,
    (m, e) => `Não foi possível enviar a foto (${e}). Verifique a conexão e escolha de novo, ou preencha manualmente.`],
  [/^No se pudo descargar: (.+)$/, (m, e) => `Não foi possível baixar: ${e}`],
  [/^Llegaste al tope de (\d+) lecturas por hoy\. Podés cargar el ticket a mano\.$/, (m, n) => `Você chegou ao limite de ${n} leituras por hoje. Pode lançar o comprovante manualmente.`],
  [/^IA (\d+) %$/, (m, n) => `IA ${n} %`],
  [/^Corregido a mano · la IA leyó: (.*)$/s, (m, x) => `Corrigido manualmente · a IA leu: ${x}`],
  [/^Factura de (.+)$/, (m, x) => `Nota de ${x}`],
  [/^Ver la factura de (.+) en grande$/, (m, x) => `Ver a nota de ${x} ampliada`],
  [/^(.+?) · Rendí$/, (m, x) => `${tr(x)} · Rendí`],
  [/^(.+?) ›$/, (m, x) => `${tr(x)} ›`],
  [/^Duplicado: este Pix \(mismo ID de transacción\) ya fue rendido en la rendición #(\d+)\.$/, (m, n) => `Duplicado: este Pix (mesmo ID de transação) já foi lançado no relatório #${n}.`],
  [/^Duplicado: este pago \(mismo medio de pago y número de operación\) ya fue rendido en la rendición #(\d+)\.$/, (m, n) => `Duplicado: este pagamento (mesmo meio e número de operação) já foi lançado no relatório #${n}.`],
  [/^Duplicado: este e-Ticket \(mismo RUT, serie y número\) ya fue rendido en la rendición #(\d+)\.$/, (m, n) => `Duplicado: esta nota (mesmo emissor, série e número) já foi lançada no relatório #${n}.`],
  // mensajes de las reglas (vienen de la base)
  [/^Bebidas alcohólicas por (.+): no se reembolsan y se descuentan solas\.$/, (m, x) => `Bebidas alcoólicas de ${x}: não são reembolsadas e são descontadas automaticamente.`],
  [/^El ticket tiene más de (\d+) días: está fuera de plazo\.$/, (m, n) => `O comprovante tem mais de ${n} dias: está fora do prazo.`],
  [/^En ese mes ya lleva (.+) rendidos y el tope mensual es (.+)\.$/, (m, a, b) => `Nesse mês já foram lançados ${a} e o limite mensal é ${b}.`],
  [/^Es un comprobante de pago(.*), no (.+?): no sirve como comprobante fiscal\. Explicá por qué no hay (.+?) \(por ejemplo, el taxi no lo emite\)\.$/,
    (m, de) => `É um comprovante de pagamento${de.replace(/^ de /, " de ")}, não uma nota fiscal: não serve como comprovante fiscal. Explique por que não há nota fiscal (por exemplo, o táxi não emite).`],
  [/^La IA leyó este ticket con confianza baja \((.+) %\)\. Verificá los datos contra la foto\.$/, (m, n) => `A IA leu este comprovante com confiança baixa (${n} %). Confira os dados com a foto.`],
  [/^La tasa de IVA da (.+) % \(lo habitual es (.+)\)\. Puede ser un ticket con tasas mezcladas o un error de lectura\.$/, (m, a, b) => `A alíquota de imposto dá ${a} % (o habitual é ${b}). Pode ser um comprovante com alíquotas mistas ou um erro de leitura.`],
  [/^Las líneas suman (.+) y el total del ticket es (.+)\. Revisá la lectura o explicá la diferencia \(propina, descuento\)\.$/, (m, a, b) => `Os itens somam ${a} e o total do comprovante é ${b}. Revise a leitura ou explique a diferença (gorjeta, desconto).`],
  [/^Neto \((.+)\) \+ IVA \((.+)\) no da el total \((.+)\)\.$/, (m, a, b, c) => `Valor sem impostos (${a}) + impostos (${b}) não dá o total (${c}).`],
  [/^Supera el tope de (.+?) para (\S+) \((.+) a reembolsar(.*)\)\.$/, (m, t, c, x, r) => `Passa do limite de ${t} para ${tr(c.charAt(0).toUpperCase() + c.slice(1)).toLowerCase()} (${x} a reembolsar${r}).`],
  [/^Corregido a mano respecto de lo que leyó la IA: (.+)$/, (m, x) => `Corrigido manualmente em relação ao que a IA leu: ${x.replace(/\bRUT\b/g, "CNPJ").split(", ").map((c) => tr(c)).join(", ")}`],
];

let activo = false;
const traduccion = new Map(Object.entries(PT));

function fechas(t) {
  return t.replace(/\b(\d{1,2}) (ene|feb|mar|abr|may|jun|jul|ago|sept|sep|set|oct|nov|dic)\.? (\d{4})\b/g, (m, d, mm, y) => `${d} ${MESES[mm]}. ${y}`);
}
function tr(s) {
  if (traduccion.has(s)) return traduccion.get(s);
  for (const [re, f] of PATRONES) { const m = s.match(re); if (m) return fechas(f(...m)); }
  // Textos armados con "·": se traduce cada parte
  if (s.includes("·")) return s.split(/(\s*·\s*)/).map((p) => (/^\s*·\s*$/.test(p) || !p ? p : tr(p))).join("");
  return fechas(s);
}
export function t(texto) {
  if (!activo || texto == null) return texto;
  const s = String(texto), lim = s.trim();
  if (!lim) return s;
  const r = tr(lim);
  return r === lim ? s : s.replace(lim, r);
}

const ATRIBUTOS = ["placeholder", "title", "aria-label", "alt"];
const NO_TOCAR = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);
function traducirNodo(n) {
  if (n.nodeType === 3) {
    const p = n.parentElement;
    if (!p || NO_TOCAR.has(p.tagName) || p.closest("[data-sin-traducir]")) return;
    const nuevo = t(n.data); if (nuevo !== n.data) n.data = nuevo;
  } else if (n.nodeType === 1) {
    if (NO_TOCAR.has(n.tagName) || n.hasAttribute("data-sin-traducir")) return;
    for (const a of ATRIBUTOS) { const v = n.getAttribute(a); if (v) { const nv = t(v); if (nv !== v) n.setAttribute(a, nv); } }
    for (const h of n.childNodes) traducirNodo(h);
  }
}
let observador = null;
export function activarIdioma(idioma) {
  activo = idioma === "pt";
  document.documentElement.lang = activo ? "pt-BR" : "es-UY";
  if (!activo) { observador?.disconnect(); observador = null; return; }
  traducirNodo(document.body);
  document.title = t(document.title);
  if (observador) return;
  observador = new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === "characterData") traducirNodo(c.target);
      else if (c.type === "attributes") traducirNodo(c.target);
      else c.addedNodes.forEach(traducirNodo);
    }
    const tt = t(document.title); if (tt !== document.title) document.title = tt;
  });
  observador.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
}
// Idioma de cada persona: el que eligió en su perfil o, si no eligió, portugués para Brasil
export function idiomaDe(perfil) {
  let elegido = null;
  try { elegido = localStorage.getItem("rendi-idioma"); } catch { /* sin almacenamiento */ }
  return elegido || (perfil?.pais === "BR" ? "pt" : "es");
}
export const idiomaActivo = () => (activo ? "pt" : "es");
