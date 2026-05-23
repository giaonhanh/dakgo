import { useCartStore } from "@/store/cartStore"

export function useCart() {
  const store = useCartStore()
  return {
    items:      store.items,
    shopId:     store.shopId,
    note:       store.note,
    totalQty:   store.totalQty(),
    totalPrice: store.totalPrice(),
    addItem:    store.addItem,
    clearAndAdd: store.clearAndAdd,
    removeItem: store.removeItem,
    updateQty:  store.updateQty,
    setItemNote: store.setItemNote,
    setNote:    store.setNote,
    clearCart:  store.clearCart,
  }
}
