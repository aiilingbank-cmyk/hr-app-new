import { API_BASE, ADMIN_TOKEN } from '../config';

export default function Settings() {
  const saveSettings = async (newSettings) => {
    const res = await fetch(`${API_BASE}/saveSettings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify(newSettings)
    });
    return res.json();
  };

  return <button onClick={()=> saveSettings({test: true})}>บันทึกการตั้งค่า</button>;
}