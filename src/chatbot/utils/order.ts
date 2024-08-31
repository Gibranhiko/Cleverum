interface OrderItem {
    producto: string;
    cantidad?: number;
    peso?: string;
}

function validateOrder(order: OrderItem[], validProducts: string[]): string | boolean {
    // Check if the order is an array and not empty
    if (!Array.isArray(order) || order.length === 0) {
        return false;
    }

    // Check if user sent not found products
    if (order[0].producto === 'undefined') {
        return false;
    }

    for (const item of order) {
        // Validate the 'producto' field
        if (!item.producto || !validProducts.includes(item.producto.toLowerCase())) {
            return false;
        }

        // Validate that either 'cantidad' or 'peso' is present
        if (typeof item.cantidad !== 'number' && typeof item.peso !== 'string') {
            return 'missing-quantity';
        }
    }

    return true;
}

export { OrderItem, validateOrder };