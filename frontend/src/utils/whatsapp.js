/**
 * Utilitário para gerar links de WhatsApp com mensagens formatadas.
 */

function formatPhone(phone) {
  // Remove tudo que não é número
  const digits = phone.replace(/\D/g, "");
  // Se não começa com 55 (Brasil), adiciona
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return `${days[d.getDay()]}, ${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

export function generateWhatsAppLink(phone, message) {
  const formattedPhone = formatPhone(phone);
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMsg}`;
}

// === MENSAGENS PARA O CLIENTE ===

export function clientConfirmationMessage(appointment, barbershopName) {
  return `Olá ${appointment.client_name}! Seu agendamento na *${barbershopName}* foi confirmado:

*Serviço:* ${appointment.service_name}
*Profissional:* ${appointment.professional_name}
*Data:* ${formatDate(appointment.date)}
*Horário:* ${appointment.start_time} - ${appointment.end_time}
*Valor:* R$ ${appointment.price.toFixed(2)}

Nos vemos lá! Qualquer dúvida, entre em contato.`;
}

export function clientReminderMessage(appointment, barbershopName) {
  return `Olá ${appointment.client_name}! Lembrete do seu agendamento na *${barbershopName}*:

*Serviço:* ${appointment.service_name}
*Profissional:* ${appointment.professional_name}
*Data:* ${formatDate(appointment.date)}
*Horário:* ${appointment.start_time}

Te esperamos! Caso precise reagendar, entre em contato.`;
}

// === MENSAGENS PARA O PROFISSIONAL ===

export function professionalConfirmationMessage(appointment, barbershopName) {
  return `Novo agendamento na *${barbershopName}*:

*Cliente:* ${appointment.client_name}
*Telefone:* ${appointment.client_phone}
*Serviço:* ${appointment.service_name}
*Data:* ${formatDate(appointment.date)}
*Horário:* ${appointment.start_time} - ${appointment.end_time}`;
}

export function professionalReminderMessage(appointments, barbershopName, date) {
  const count = appointments.length;
  let msg = `Olá! Lembrete da sua agenda na *${barbershopName}* para ${formatDate(date)}:\n\n`;
  msg += `*${count} agendamento${count > 1 ? "s" : ""}:*\n`;
  appointments.forEach((a, i) => {
    msg += `\n${i + 1}. *${a.start_time}* - ${a.client_name} (${a.service_name})`;
  });
  msg += `\n\nBom trabalho!`;
  return msg;
}

// === LINKS PRONTOS ===

export function getClientConfirmationLink(appointment, barbershopName) {
  const msg = clientConfirmationMessage(appointment, barbershopName);
  return generateWhatsAppLink(appointment.client_phone, msg);
}

export function getClientReminderLink(appointment, barbershopName) {
  const msg = clientReminderMessage(appointment, barbershopName);
  return generateWhatsAppLink(appointment.client_phone, msg);
}

export function getProfessionalConfirmationLink(professionalPhone, appointment, barbershopName) {
  const msg = professionalConfirmationMessage(appointment, barbershopName);
  return generateWhatsAppLink(professionalPhone, msg);
}

export function getProfessionalDayReminderLink(professionalPhone, appointments, barbershopName, date) {
  const msg = professionalReminderMessage(appointments, barbershopName, date);
  return generateWhatsAppLink(professionalPhone, msg);
}
