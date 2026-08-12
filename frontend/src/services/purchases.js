export const fetchPurchases = async () => {
  const response = await fetch('http://localhost:8001/purchases', { // تأكد من مطابقة المسار في backend/purchases.py
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });
  return response.json();
};