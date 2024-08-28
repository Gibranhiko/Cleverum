import React from 'react';
import AppointmentTable from './components/appointmentTable';

const App: React.FC = () => {
  return (
    <div>
      <h1>Appointment List</h1>
      <AppointmentTable />
    </div>
  );
};

export default App;