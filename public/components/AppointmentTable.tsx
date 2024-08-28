import React from 'react';
import './AppointmentTable.css'; // Import the CSS file

const appointments = [
    {
        nombre: 'Gibran Villarreal',
        motivo: 'Venta de casa',
        telefono: '8119939079',
        dia: '12/08/2024',
        hora: '10:00 AM',
    },
    {
        nombre: 'Paola García',
        motivo: 'Compra casa',
        telefono: '8134569876',
        dia: '12/08/2024',
        hora: '11:00 AM',
    },
    {
        nombre: 'Gibran Villarreal',
        motivo: 'Credito infonavit',
        telefono: '8119939079',
        dia: '13/08/2024',
        hora: '10:00 AM',
    },
    {
        nombre: 'Paola García',
        motivo: 'Renta de casa',
        telefono: '8134569876',
        dia: '13/08/2024',
        hora: '11:00 AM',
    },
    {
        nombre: 'Amanda Villarreal',
        motivo: 'Venta de casa',
        telefono: '8184566587',
        dia: '14/08/2024',
        hora: '2:00 PM',
    },
    {
        nombre: 'Amelia Villarreal',
        motivo: 'Quiero checar mi crédito',
        telefono: '8229965458',
        dia: '20/08/2024',
        hora: '9:00 AM',
    },
    {
        nombre: 'Amanda Díaz',
        motivo: 'Credito facil',
        telefono: '8115469873',
        dia: '19/08/2024',
        hora: '2:00 PM',
    },
];

const AppointmentTable: React.FC = () => {
  return (
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Motivo</th>
          <th>Telefono</th>
          <th>Dia</th>
          <th>Hora</th>
        </tr>
      </thead>
      <tbody>
        {appointments.map((appointment, index) => (
          <tr key={index}>
            <td data-label="Nombre">{appointment.nombre}</td>
            <td data-label="Motivo">{appointment.motivo}</td>
            <td data-label="Telefono">{appointment.telefono}</td>
            <td data-label="Dia">{appointment.dia}</td>
            <td data-label="Hora">{appointment.hora}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AppointmentTable;
