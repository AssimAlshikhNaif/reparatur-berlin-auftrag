import api from "@/lib/api";

// Fetch all procurement items for a given order (Auftrag).
export const fetchPurchases = async (orderId) => {
  const { data } = await api.get(`/purchases/order/${orderId}`);
  return data;
};

export const createPurchase = async (payload) => {
  const { data } = await api.post(`/purchases`, payload);
  return data;
};

export const updatePurchase = async (id, updates) => {
  const { data } = await api.patch(`/purchases/${id}`, updates);
  return data;
};

export const deletePurchase = async (id) => {
  const { data } = await api.delete(`/purchases/${id}`);
  return data;
};
