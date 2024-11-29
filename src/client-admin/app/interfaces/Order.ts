export default interface Order {
  _id: string;
  nombre: string;
  orden: string;
  telefono: string;
  fecha: string;
  status: boolean;
  tipoEntrega: string;
  total: number;
  dirección: string;
  ubicación: string;
  pago: string;
}