import { cachedGet, invalidate } from "@/lib/http-cache";

// Hostinger MySQL REST API Helper
// Replace this URL with your Hostinger API URL after deployment
const API_BASE = import.meta.env.VITE_API_URL || "https://api.vedicupchar.com";

const getToken = () => localStorage.getItem("auth_token");

const headers = (extra?: Record<string, string>) => {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
};

const handleRes = async (res: Response) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API Error");
  return data;
};

// Auth
export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const data = await handleRes(await fetch(`${API_BASE}/api/auth/login`, { method: "POST", headers: headers(), body: JSON.stringify({ email, password }) }));
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("auth-change"));
      return data;
    },
    signup: async (email: string, password: string, full_name?: string, phone?: string) => {
      const data = await handleRes(await fetch(`${API_BASE}/api/auth/signup`, { method: "POST", headers: headers(), body: JSON.stringify({ email, password, full_name, phone }) }));
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("auth-change"));
      return data;
    },
    signOut: () => {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      window.dispatchEvent(new Event("auth-change"));
    },
    getUser: () => {
      const u = localStorage.getItem("auth_user");
      return u ? JSON.parse(u) : null;
    },
    getToken,
    isLoggedIn: () => !!getToken(),
    isAdmin: () => {
      const u = localStorage.getItem("auth_user");
      if (!u) return false;
      return JSON.parse(u).role === "admin";
    },
    me: async () => handleRes(await fetch(`${API_BASE}/api/auth/me`, { headers: headers() })),
  },

  // Generic fetch helpers (GET responses are cached + deduped in memory)
  get: async (path: string) =>
    cachedGet(`api:${path}`, async () =>
      handleRes(await fetch(`${API_BASE}${path}`, { headers: headers() })),
    ),
  post: async (path: string, body: any) => {
    const r = handleRes(await fetch(`${API_BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) }));
    invalidate();
    return r;
  },
  put: async (path: string, body: any) => {
    const r = handleRes(await fetch(`${API_BASE}${path}`, { method: "PUT", headers: headers(), body: JSON.stringify(body) }));
    invalidate();
    return r;
  },
  del: async (path: string) => {
    const r = handleRes(await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: headers() }));
    invalidate();
    return r;
  },

  // Products
  products: {
    list: (params?: Record<string, string>) => {
      const q = params ? "?" + new URLSearchParams(params).toString() : "";
      return api.get(`/api/products${q}`);
    },
    adminList: () => api.get("/api/products/admin/all"),
    get: async (slug: string) => {
      const data = await api.get(`/api/products?slug=${slug}`);
      return data[0] || null;
    },
    create: (body: any) => api.post("/api/products", body),
    update: (id: string, body: any) => api.put(`/api/products/${id}`, body),
    delete: (id: string) => api.del(`/api/products/${id}`),
    search: (query: string) => api.get(`/api/products?search=${encodeURIComponent(query)}&limit=8`),
  },

  // Categories
  categories: {
    list: () => api.get("/api/categories"),
    adminList: () => api.get("/api/categories/admin/all"),
    create: (body: any) => api.post("/api/categories", body),
    update: (id: string, body: any) => api.put(`/api/categories/${id}`, body),
    delete: (id: string) => api.del(`/api/categories/${id}`),
  },

  // Orders
  orders: {
    create: (body: any) => api.post("/api/orders", body),
    my: () => api.get("/api/orders/my"),
    adminList: () => api.get("/api/orders/admin/all"),
    getItems: (orderId: string) => api.get(`/api/orders/${orderId}/items`),
    update: (id: string, body: any) => api.put(`/api/orders/${id}`, body),
    updateItem: (id: string, body: any) => api.put(`/api/orders/items/${id}`, body),
    deleteItem: (id: string) => api.del(`/api/orders/items/${id}`),
  },

  // Blogs
  blogs: {
    list: (publishedOnly = true) => api.get(`/api/blogs?published_only=${publishedOnly}`),
    get: async (slug: string) => {
      const data = await api.get(`/api/blogs?slug=${slug}`);
      return data[0] || null;
    },
    adminList: () => api.get("/api/blogs/admin/all"),
    create: (body: any) => api.post("/api/blogs", body),
    update: (id: string, body: any) => api.put(`/api/blogs/${id}`, body),
    delete: (id: string) => api.del(`/api/blogs/${id}`),
  },

  // Banners
  banners: {
    list: (section?: string) => api.get(`/api/banners${section ? `?section=${section}` : ""}`),
    adminList: () => api.get("/api/banners/admin/all"),
    create: (body: any) => api.post("/api/banners", body),
    update: (id: string, body: any) => api.put(`/api/banners/${id}`, body),
    delete: (id: string) => api.del(`/api/banners/${id}`),
  },

  // Consultations
  consultations: {
    submit: (body: any) => api.post("/api/consultations", body),
    adminList: () => api.get("/api/consultations/admin/all"),
    update: (id: string, body: any) => api.put(`/api/consultations/${id}`, body),
  },

  // Settings
  settings: {
    list: () => api.get("/api/settings"),
    save: (body: any) => api.post("/api/settings", body),
    update: (id: string, body: any) => api.put(`/api/settings/${id}`, body),
  },

  // Offers
  offers: {
    list: () => api.get("/api/offers"),
    adminList: () => api.get("/api/offers/admin/all"),
    create: (body: any) => api.post("/api/offers", body),
    update: (id: string, body: any) => api.put(`/api/offers/${id}`, body),
    delete: (id: string) => api.del(`/api/offers/${id}`),
  },
};

export default api;
