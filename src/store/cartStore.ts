import { create } from "zustand";

export interface CartItemBreakdown {
  basePrice: number;
  sizeLabel?: string;
  sizeDiff?: number;
  toppings?: { name: string; price: number }[];
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  shop: string;
  shopId: string;
  imageUrl?: string;
  note?: string;
  breakdown?: CartItemBreakdown;
}

interface CartStore {
  items: CartItem[];
  note: string;
  shopId: string | null;
  addItem: (item: Omit<CartItem, "qty">) => void;
  clearAndAdd: (item: Omit<CartItem, "qty">) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  setItemNote: (id: string, note: string) => void;
  setNote: (note: string) => void;
  clearCart: () => void;
  totalPrice: () => number;
  totalQty: () => number;
}

export const useCartStore = create<CartStore>()((set, get) => ({
  items: [],
  note: "",
  shopId: null,

  clearAndAdd: (item) =>
    set({ items: [{ ...item, qty: 1 }], note: "", shopId: item.shopId }),

  addItem: (newItem) => {
    const items = get().items;
    const existing = items.find((i) => i.id === newItem.id);
    if (existing) {
      set({ items: items.map((i) => i.id === newItem.id ? { ...i, qty: i.qty + 1 } : i) });
    } else {
      set({ items: [...items, { ...newItem, qty: 1 }], shopId: newItem.shopId });
    }
  },

  removeItem: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    set({ items, shopId: items.length === 0 ? null : get().shopId });
  },

  updateQty: (id, qty) => {
    if (qty <= 0) { get().removeItem(id); return; }
    set({ items: get().items.map((i) => i.id === id ? { ...i, qty } : i) });
  },

  setItemNote: (id, note) =>
    set({ items: get().items.map(i => i.id === id ? { ...i, note } : i) }),

  setNote: (note) => set({ note }),

  clearCart: () => set({ items: [], note: "", shopId: null }),

  totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),

  totalQty: () => get().items.reduce((sum, i) => sum + i.qty, 0),
}));
