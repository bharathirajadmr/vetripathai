export const getScheduleKey = (email: string) =>
  `schedule_${email.toLowerCase()}`;

export const saveSchedule = (email: string, data: any) => {
  localStorage.setItem(getScheduleKey(email), JSON.stringify(data));
};

export const loadSchedule = (email: string) => {
  const raw = localStorage.getItem(getScheduleKey(email));
  return raw ? JSON.parse(raw) : null;
};

export const clearSchedule = (email: string) => {
  localStorage.removeItem(getScheduleKey(email));
};