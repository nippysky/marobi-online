// lib/customers.ts

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;      // in NGN
  lastLogin: string;       // ISO date
  registeredAt: string;    // ISO date
}

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString();
}

export function generateDummyCustomers(count: number): Customer[] {
  const first = ["Alice","Bob","Carol","David","Eve","Frank","Grace","Hank"];
  const last  = ["Johnson","Smith","Lee","Brown","Davis","Miller","Wilson","Taylor"];
  return Array.from({ length: count }).map((_, i) => {
    const id = `CUST${(1000+i).toString().padStart(4,"0")}`;
    const name = `${first[i % first.length]} ${last[i % last.length]}`;
    const email = `${name.toLowerCase().replace(" ",".")}@example.com`;
    const phone = `+23480${Math.floor(10000000 + Math.random()*90000000)}`;
    const totalOrders = Math.floor(Math.random()*20);
    const totalSpent  = Math.round(Math.random()*500000);
    const registeredAt = randomDate(new Date(2022,0,1), new Date());
    const lastLogin    = randomDate(new Date(2023,0,1), new Date());
    return { id, name, email, phone, totalOrders, totalSpent, registeredAt, lastLogin };
  });
}
