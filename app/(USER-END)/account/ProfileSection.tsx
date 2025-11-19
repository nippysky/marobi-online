"use client";

import React, { ReactNode, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "react-hot-toast";
import { User, Mail, Phone, MapPin, Bookmark } from "lucide-react";

interface ProfileSectionProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    billingAddress: string;
    country: string;
    state: string;
    registeredAt: string;
    lastLogin: string | null;
  };
}

const Field = ({
  icon: Icon,
  label,
  htmlFor,
  children,
  span2 = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  htmlFor: string;
  children: ReactNode;
  span2?: boolean;
}) => (
  <div className={`${span2 ? "md:col-span-2" : ""} flex flex-col gap-1`}>
    <div className="flex items-center gap-2 text-gray-700">
      <Icon className="w-4 h-4" />
      <label htmlFor={htmlFor} className="font-medium">
        {label}
      </label>
    </div>
    {children}
  </div>
);

export default function ProfileSection({ user }: ProfileSectionProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirst] = useState(user.firstName);
  const [lastName, setLast] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [address, setAddress] = useState(user.address);
  const [billing, setBilling] = useState(user.billingAddress);
  const [country, setCountry] = useState(user.country);
  const [stateVal, setStateVal] = useState(user.state);

  const onSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          deliveryAddress: address,
          billingAddress: billing,
          country,
          state: stateVal,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Profile updated!");
      setEditing(false);
    } catch {
      toast.error("Save failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <Card className="backdrop-blur-sm bg-white/60">
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {!editing ? (
            <div className="space-y-4">
              <p className="text-gray-800">
                <User className="inline w-5 h-5 mr-2 text-brand align-middle" />
                {firstName} {lastName}
              </p>
              <p className="text-gray-800">
                <Mail className="inline w-5 h-5 mr-2 text-brand align-middle" />
                {email}
              </p>
              <p className="text-gray-800">
                <Phone className="inline w-5 h-5 mr-2 text-brand align-middle" />
                {phone}
              </p>
              <p className="text-gray-800">
                <MapPin className="inline w-5 h-5 mr-2 text-brand align-middle" />
                {address}
              </p>
              <p className="text-gray-800">
                <Bookmark className="inline w-5 h-5 mr-2 text-brand align-middle" />
                Billing: {billing}
              </p>
              <Button className="bg-gradient-to-r from-brand to-green-700" onClick={() => setEditing(true)} size="sm">
                Edit Profile
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field icon={User} label="First Name" htmlFor="firstName">
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirst(e.target.value)}
                  disabled={loading}
                />
              </Field>
              <Field icon={User} label="Last Name" htmlFor="lastName">
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLast(e.target.value)}
                  disabled={loading}
                />
              </Field>
              <Field icon={Mail} label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </Field>
              <Field icon={Phone} label="Phone" htmlFor="phone">
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </Field>
              <Field icon={MapPin} label="Delivery Address" htmlFor="address" span2>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={loading}
                  rows={3}
                />
              </Field>
              <Field icon={Bookmark} label="Billing Address" htmlFor="billingAddress" span2>
                <Textarea
                  id="billingAddress"
                  value={billing}
                  onChange={(e) => setBilling(e.target.value)}
                  disabled={loading}
                  rows={3}
                />
              </Field>
              <div className="md:col-span-2 flex gap-2 pt-4">
                <Button onClick={onSave} disabled={loading} className="flex-1 bg-gradient-to-r from-brand to-green-700">
                  {loading ? "Saving…" : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)} className="flex-1" disabled={loading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
