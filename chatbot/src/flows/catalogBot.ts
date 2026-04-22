import supabase from '../lib/supabase'
import { getSession, updateSession, appendToHistory } from '../lib/session'
import { sendText, sendList, sendButtons, sendImage } from '../lib/whatsapp'
import { ai } from '../services/ai'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { BotContext } from '../types'

interface CartItem {
  id: string
  name: string
  category: string
}

interface CartState {
  items: CartItem[]
  customer_name?: string
  delivery_type?: string
  address?: string
}

export async function handleCatalogBot(ctx: BotContext) {
  const { session } = ctx

  switch (session.flow_step) {
    case null:
    case 'idle':
      return showCategoryMenu(ctx)
    case 'category_selected':
      return handleCategorySelection(ctx)
    case 'product_selected':
      return handleProductAction(ctx)
    case 'customer_name':
      return handleCustomerName(ctx)
    case 'checkout':
      return handleDeliveryType(ctx)
    case 'address':
      return handleAddress(ctx)
    case 'confirming':
      return handleConfirmation(ctx)
    default:
      return showCategoryMenu(ctx)
  }
}

async function showCategoryMenu(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  const { data: products } = await supabase
    .from('products')
    .select('category')
    .eq('client_id', clientId)

  const categories = [...new Set((products ?? []).map((p: any) => p.category).filter(Boolean))] as string[]

  if (categories.length === 0) {
    await sendText(pid, token, from, 'No hay productos disponibles por el momento.')
    return
  }

  await sendList(
    pid, token, from,
    `Bienvenido a ${client.company_name}`,
    '¿Qué te gustaría ordenar hoy? Selecciona una categoría:',
    'Ver categorías',
    [{ title: 'Categorías', rows: categories.map(cat => ({ id: `cat:${cat}`, title: cat })) }]
  )

  await updateSession(clientId, from, {
    current_flow: 'catalog',
    flow_step: 'category_selected',
    state: { cart: { items: [] } },
  })
}

async function handleCategorySelection(ctx: BotContext) {
  const { text, from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  if (!text.startsWith('cat:')) return showCategoryMenu(ctx)

  const category = text.replace('cat:', '')

  const { data: products } = await supabase
    .from('products')
    .select('id, name, description')
    .eq('client_id', clientId)
    .eq('category', category)

  if (!products || products.length === 0) {
    await sendText(pid, token, from, 'No hay productos en esta categoría.')
    return showCategoryMenu(ctx)
  }

  await sendList(
    pid, token, from,
    category,
    'Selecciona un producto para ver sus detalles:',
    'Ver productos',
    [{
      title: category,
      rows: products.map((p: any) => ({
        id: `prod:${p.id}`,
        title: p.name,
        description: p.description?.substring(0, 72) ?? '',
      })),
    }]
  )

  const session = await getSession(clientId, from)
  const state = (session.state ?? {}) as Record<string, any>
  await updateSession(clientId, from, {
    flow_step: 'product_selected',
    state: { ...state, selectedCategory: category },
  })
}

async function handleProductAction(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const state = (session.state ?? {}) as Record<string, any>
  const cart: CartState = state.cart ?? { items: [] }

  if (text === 'add_to_cart') {
    const pending = state.pendingProduct as CartItem | undefined
    if (pending) cart.items.push(pending)
    await updateSession(clientId, from, { state: { ...state, cart, pendingProduct: null } })

    await sendButtons(pid, token, from,
      `✅ *${pending?.name ?? 'Producto'}* agregado al carrito.\n🛒 ${cart.items.length} artículo(s).`,
      [
        { id: 'checkout', title: '✅ Finalizar pedido' },
        { id: `cat:${state.selectedCategory ?? ''}`, title: '📋 Agregar más' },
      ]
    )
    await updateSession(clientId, from, { flow_step: 'category_selected' })
    return
  }

  if (text === 'checkout') {
    const pending = state.pendingProduct as CartItem | undefined
    if (pending) cart.items.push(pending)
    await updateSession(clientId, from, { state: { ...state, cart, pendingProduct: null } })
    return startCheckout({ ...ctx, session: await getSession(clientId, from) }, cart)
  }

  if (text === 'view_more') {
    const freshSession = await getSession(clientId, from)
    const freshState = (freshSession.state ?? {}) as Record<string, any>
    return handleCatalogBot({ ...ctx, text: `cat:${freshState.selectedCategory ?? ''}`, session: freshSession })
  }

  if (!text.startsWith('prod:')) return showCategoryMenu(ctx)

  const productId = text.replace('prod:', '')
  const { data: product } = await supabase.from('products').select('*').eq('id', productId).single()

  if (!product) {
    await sendText(pid, token, from, 'Producto no encontrado.')
    return showCategoryMenu(ctx)
  }

  const detail = [
    `*${product.name}*`,
    product.description ? `\n${product.description}` : '',
    product.includes ? `\n✅ Incluye: ${product.includes}` : '',
  ].filter(Boolean).join('')

  if (product.image_url) {
    await sendImage(pid, token, from, product.image_url, detail)
  } else {
    await sendText(pid, token, from, detail)
  }

  await sendButtons(pid, token, from, '¿Qué deseas hacer?', [
    { id: 'add_to_cart', title: '🛒 Agregar al carrito' },
    { id: 'checkout', title: '✅ Finalizar pedido' },
    { id: 'view_more', title: '📋 Ver otro' },
  ])

  await updateSession(clientId, from, {
    flow_step: 'product_selected',
    state: {
      ...state,
      pendingProduct: { id: product.id, name: product.name, category: product.category },
    },
  })
}

async function startCheckout(ctx: BotContext, cart: CartState) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  if (cart.items.length === 0) {
    await sendText(pid, token, from, 'Tu carrito está vacío. Selecciona algún producto primero.')
    return showCategoryMenu(ctx)
  }

  await sendText(pid, token, from, '¿Cuál es tu nombre completo para el pedido?')
  await updateSession(clientId, from, { flow_step: 'customer_name' })
}

async function handleCustomerName(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const state = (session.state ?? {}) as Record<string, any>
  const cart: CartState = state.cart ?? { items: [] }

  cart.customer_name = text.trim()
  await updateSession(clientId, from, { state: { ...state, cart }, flow_step: 'checkout' })

  await sendButtons(pid, token, from, '¿Cómo deseas recibir tu pedido?', [
    { id: 'delivery', title: '🛵 A domicilio' },
    { id: 'pickup', title: '🏪 Para recoger' },
  ])
}

async function handleDeliveryType(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const state = (session.state ?? {}) as Record<string, any>
  const cart: CartState = state.cart ?? { items: [] }

  if (text !== 'delivery' && text !== 'pickup') {
    return sendButtons(pid, token, from, '¿Cómo deseas recibir tu pedido?', [
      { id: 'delivery', title: '🛵 A domicilio' },
      { id: 'pickup', title: '🏪 Para recoger' },
    ])
  }

  cart.delivery_type = text
  await updateSession(clientId, from, { state: { ...state, cart } })

  if (text === 'delivery') {
    await sendText(pid, token, from, '¿Cuál es tu dirección de entrega?')
    await updateSession(clientId, from, { flow_step: 'address' })
  } else {
    await showOrderSummary(ctx, cart)
    await updateSession(clientId, from, { flow_step: 'confirming' })
  }
}

async function handleAddress(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { id: clientId } = client
  const state = (session.state ?? {}) as Record<string, any>
  const cart: CartState = state.cart ?? { items: [] }

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: 'Format and return the delivery address from the user message. Return just the formatted address, nothing else.' },
    { role: 'user', content: text },
  ]
  const address = (await ai.createChat(messages)) || text
  cart.address = address

  await updateSession(clientId, from, { state: { ...state, cart }, flow_step: 'confirming' })
  await showOrderSummary(ctx, cart)
}

async function showOrderSummary(ctx: BotContext, cart: CartState) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token } = client

  const itemsList = cart.items.map(i => `• ${i.name}`).join('\n')
  const deliveryStr = cart.delivery_type === 'delivery'
    ? `🛵 A domicilio${cart.address ? `\n📍 ${cart.address}` : ''}`
    : '🏪 Para recoger'

  await sendButtons(pid, token, from,
    `📋 *Resumen de tu pedido:*\n\n${itemsList}\n\n${deliveryStr}`,
    [
      { id: 'confirm_order', title: '✅ Confirmar pedido' },
      { id: 'cancel_order', title: '❌ Cancelar' },
    ]
  )
}

async function handleConfirmation(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const state = (session.state ?? {}) as Record<string, any>
  const cart: CartState = state.cart ?? { items: [] }

  if (text === 'cancel_order') {
    await sendText(pid, token, from, 'Pedido cancelado. ¡Cuando quieras podemos empezar de nuevo! 😊')
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    return
  }

  if (text !== 'confirm_order') return showOrderSummary(ctx, cart)

  const { error } = await supabase.from('orders').insert({
    client_id: clientId,
    customer_name: cart.customer_name ?? null,
    customer_phone: from,
    items: cart.items.map(i => ({ name: i.name, category: i.category })),
    delivery_type: cart.delivery_type,
    address: cart.address ?? null,
    status: false,
  })

  if (error) {
    console.error('[CatalogBot] Order error:', error)
    await sendText(pid, token, from, 'Hubo un error al registrar tu pedido. Intenta de nuevo.')
    return
  }

  await sendText(pid, token, from,
    '✅ ¡Pedido registrado! Nuestro equipo lo recibirá en breve y se pondrá en contacto contigo. ¡Gracias! 🎉')
  await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
}
