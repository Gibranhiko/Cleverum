import { parse, format } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from 'date-fns-tz';

const getFullCurrentDate = (): string => {
  const currentD = new Date();
  const formatDate = format(currentD, "yyyy/MM/dd HH:mm", { locale: es });
  const day = format(currentD, "EEEE", { locale: es });

  return [formatDate, day].join(" ");
};

const getDayToday = (): string => {
  const currentD = new Date();
  const formatDate = format(currentD, "yyyy/MM/dd HH:mm", { locale: es });
  const day = format(currentD, "EEEE", { locale: es });

  return [day].join(" ");
};

function formatToISO(data: string[][]): Date[] {
  return data.slice(1).map(([dia, hora]) => {
    return parse(`${dia} ${hora}`, "dd/MM/yyyy h:mm a", new Date());
  });
}

const isWorkableDate = (date: Date): boolean => {
  const day = date.getDay();
  const hour = date.getHours();

  if (day >= 1 && day <= 5) {
    if (hour >= 9 && hour <= 18) {
      return true;
    }
  }
  return false;
};

function splitISODate(ISODate: Date): string[] {
  const timeZone = 'America/Mexico_City';
  const toSpecificZone = toZonedTime(ISODate, timeZone);

  const formatDate = format(toSpecificZone, 'dd/MM/yyyy');
  const formatHours = format(toSpecificZone, 'h:mm a');

  return [formatDate, formatHours];
}

export { getFullCurrentDate, formatToISO, isWorkableDate, splitISODate, getDayToday };
