import axios from "axios";

const BACKEND_URL = window.__BACKEND_URL__ || window.location.origin;
const API = `${BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

/**
 * Service para operações do painel master.
 */
export const masterService = {
  /**
   * Buscar estatísticas gerais da plataforma.
   */
  getStats: async () => {
    const response = await axios.get(`${API}/master/stats`);
    return response.data;
  },

  /**
   * Listar todas as barbearias.
   */
  listBarbershops: async () => {
    const response = await axios.get(`${API}/master/barbershops`);
    return response.data;
  },

  /**
   * Buscar barbearia por ID.
   */
  getBarbershop: async (id) => {
    const response = await axios.get(`${API}/master/barbershops/${id}`);
    return response.data;
  },

  /**
   * Criar nova barbearia.
   */
  createBarbershop: async (data) => {
    const response = await axios.post(`${API}/master/barbershops`, data);
    return response.data;
  },

  /**
   * Atualizar barbearia.
   */
  updateBarbershop: async (id, data) => {
    const response = await axios.put(`${API}/master/barbershops/${id}`, data);
    return response.data;
  },

  /**
   * Deletar (desativar) barbearia.
   */
  deleteBarbershop: async (id) => {
    const response = await axios.delete(`${API}/master/barbershops/${id}`);
    return response.data;
  },
};

/**
 * Service para operações da barbearia.
 */
export const barbershopService = {
  // Dashboard
  getDashboard: async () => {
    const response = await axios.get(`${API}/barbershop/dashboard`);
    return response.data;
  },

  // Relatório Financeiro
  getFinancialReport: async (period = "month") => {
    const response = await axios.get(`${API}/barbershop/financial-report?period=${period}`);
    return response.data;
  },

  // Clientes
  listClients: async () => {
    const response = await axios.get(`${API}/barbershop/clients`);
    return response.data;
  },

  createClient: async (data) => {
    const response = await axios.post(`${API}/barbershop/clients`, data);
    return response.data;
  },

  updateClient: async (id, data) => {
    const response = await axios.put(`${API}/barbershop/clients/${id}`, data);
    return response.data;
  },

  deleteClient: async (id) => {
    const response = await axios.delete(`${API}/barbershop/clients/${id}`);
    return response.data;
  },

  getClientHistory: async (id) => {
    const response = await axios.get(`${API}/barbershop/clients/${id}/history`);
    return response.data;
  },

  // Serviços
  listServices: async () => {
    const response = await axios.get(`${API}/barbershop/services`);
    return response.data;
  },

  createService: async (data) => {
    const response = await axios.post(`${API}/barbershop/services`, data);
    return response.data;
  },

  updateService: async (id, data) => {
    const response = await axios.put(`${API}/barbershop/services/${id}`, data);
    return response.data;
  },

  deleteService: async (id) => {
    const response = await axios.delete(`${API}/barbershop/services/${id}`);
    return response.data;
  },

  // Profissionais
  listProfessionals: async () => {
    const response = await axios.get(`${API}/barbershop/professionals`);
    return response.data;
  },

  createProfessional: async (data) => {
    const response = await axios.post(`${API}/barbershop/professionals`, data);
    return response.data;
  },

  updateProfessional: async (id, data) => {
    const response = await axios.put(`${API}/barbershop/professionals/${id}`, data);
    return response.data;
  },

  deleteProfessional: async (id) => {
    const response = await axios.delete(`${API}/barbershop/professionals/${id}`);
    return response.data;
  },

  // Agendamentos
  listAppointments: async (date) => {
    const params = date ? `?date=${date}` : "";
    const response = await axios.get(`${API}/barbershop/appointments${params}`);
    return response.data;
  },

  createAppointment: async (data) => {
    const response = await axios.post(`${API}/barbershop/appointments`, data);
    return response.data;
  },

  updateAppointmentStatus: async (id, status) => {
    const response = await axios.put(`${API}/barbershop/appointments/${id}/status`, { status });
    return response.data;
  },

  deleteAppointment: async (id) => {
    const response = await axios.delete(`${API}/barbershop/appointments/${id}`);
    return response.data;
  },

  // Horários de funcionamento
  getWorkingHours: async () => {
    const response = await axios.get(`${API}/barbershop/working-hours`);
    return response.data;
  },

  updateWorkingHours: async (data) => {
    const response = await axios.put(`${API}/barbershop/working-hours`, data);
    return response.data;
  },

  // Estilos de corte
  listStyles: async () => {
    const response = await axios.get(`${API}/barbershop/styles`);
    return response.data;
  },

  createStyle: async (data) => {
    const response = await axios.post(`${API}/barbershop/styles`, data);
    return response.data;
  },

  updateStyle: async (id, data) => {
    const response = await axios.put(`${API}/barbershop/styles/${id}`, data);
    return response.data;
  },

  deleteStyle: async (id) => {
    const response = await axios.delete(`${API}/barbershop/styles/${id}`);
    return response.data;
  },

  uploadStyleImage: async (id, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post(`${API}/barbershop/styles/${id}/upload-image`, formData);
    return response.data;
  },

  // Catálogo global de estilos
  getCatalogStyles: async () => {
    const response = await axios.get(`${API}/barbershop/styles/catalog`);
    return response.data;
  },

  importCatalogStyle: async (globalId) => {
    const response = await axios.post(`${API}/barbershop/styles/import/${globalId}`);
    return response.data;
  },
};

/**
 * Service para o painel do cliente.
 */
export const clientService = {
  register: async (data) => {
    const response = await axios.post(`${API}/auth/register-client`, data);
    return response.data;
  },

  getProfile: async () => {
    const response = await axios.get(`${API}/client/me`);
    return response.data;
  },

  getAiHistory: async () => {
    const response = await axios.get(`${API}/client/ai-history`);
    return response.data;
  },

  getAppointments: async () => {
    const response = await axios.get(`${API}/client/appointments`);
    return response.data;
  },
};
