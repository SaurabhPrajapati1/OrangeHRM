import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('SCN', () => {

  // Test Case: Register new user via API with valid payload
  test('SCN-001: Register new user via API with valid payload', async ({ request }) => {
    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const payload = {
      email: uniqueEmail,
      name: 'Test User',
      password: 'ValidPass123!'
    };

    // Step 1: Send POST request to /api/register with valid JSON payload
    const registerResponse = await request.post(`${BASE_URL}/api/register`, {
      data: payload
    });

    expect(registerResponse.status()).toBe(201);

    const registerBody = await registerResponse.json();

    // Step 2: Verify response contains a valid user ID or token
    expect(registerBody).toHaveProperty('userId');
    expect(registerBody).toHaveProperty('email');
    expect(registerBody.email).toBe(uniqueEmail);

    const userId = registerBody.userId;

    // Step 3: Send GET request to /api/users/{userId} to verify persisted data
    const getUserResponse = await request.get(`${BASE_URL}/api/users/${userId}`);
    expect(getUserResponse.status()).toBe(200);

    const getUserBody = await getUserResponse.json();
    expect(getUserBody.email).toBe(uniqueEmail);
    expect(getUserBody.name).toBe(payload.name);
  });

  // Test Case: Login API returns 401 for incorrect password
  test('SCN-002: Login API returns 401 for incorrect password', async ({ request }) => {
    const loginPayload = {
      email: 'existinguser@example.com',
      password: 'WrongPassword123!'
    };

    // Step 1: Send POST request to /api/login with valid email and incorrect password
    const loginResponse = await request.post(`${BASE_URL}/api/login`, {
      data: loginPayload
    });

    // Step 2: Inspect the HTTP response status code
    expect(loginResponse.status()).toBe(401);

    // Step 3: Inspect the response body for error message and absence of token
    const loginBody = await loginResponse.json();
    expect(loginBody).toHaveProperty('message');
    expect(loginBody.message.toLowerCase()).toContain('invalid');
    expect(loginBody).not.toHaveProperty('token');
    expect(loginBody).not.toHaveProperty('accessToken');
  });

  // Test Case: Filter products by category via API
  test('SCN-003: Filter products by category via API', async ({ request }) => {
    // Step 1: Send GET request to /api/products?category=Electronics
    const filterResponse = await request.get(`${BASE_URL}/api/products`, {
      params: { category: 'Electronics' }
    });

    expect(filterResponse.status()).toBe(200);

    const filterBody = await filterResponse.json();
    expect(Array.isArray(filterBody)).toBeTruthy();

    // Step 2: Inspect the category field of each product in the response
    if (filterBody.length > 0) {
      for (const product of filterBody) {
        expect(product.category).toBe('Electronics');
      }
    }

    // Step 3: Send GET request with non-existent category
    const noResultsResponse = await request.get(`${BASE_URL}/api/products`, {
      params: { category: 'NonExistentCategory' }
    });

    expect(noResultsResponse.status()).toBe(200);

    const noResultsBody = await noResultsResponse.json();
    expect(Array.isArray(noResultsBody)).toBeTruthy();
    expect(noResultsBody.length).toBe(0);
  });

  // Test Case: Checkout API processes order and payment successfully
  test('SCN-004: Checkout API processes order and payment successfully', async ({ request }) => {
    const checkoutPayload = {
      cartId: 'cart_12345',
      shippingDetails: {
        fullName: 'Jane Doe',
        addressLine1: '123 Main St',
        city: 'Springfield',
        postalCode: '12345',
        country: 'US'
      },
      paymentToken: 'sandbox_tok_visa_success'
    };

    // Step 1: Send POST request to /api/checkout with valid cart, shipping, and payment token
    const checkoutResponse = await request.post(`${BASE_URL}/api/checkout`, {
      data: checkoutPayload
    });

    expect([200, 201]).toContain(checkoutResponse.status());

    const checkoutBody = await checkoutResponse.json();

    // Step 2: Verify response contains order ID, order status, and payment status fields
    expect(checkoutBody).toHaveProperty('orderId');
    expect(checkoutBody).toHaveProperty('orderStatus');
    expect(checkoutBody).toHaveProperty('paymentStatus');
    expect(checkoutBody.orderStatus).toBe('confirmed');
    expect(checkoutBody.paymentStatus).toBe('success');

    const orderId = checkoutBody.orderId;

    // Step 3: Send GET request to /api/orders/{orderId} to verify persisted order data
    const getOrderResponse = await request.get(`${BASE_URL}/api/orders/${orderId}`);
    expect(getOrderResponse.status()).toBe(200);

    const getOrderBody = await getOrderResponse.json();
    expect(getOrderBody.orderId).toBe(orderId);
    expect(getOrderBody.cartId).toBe(checkoutPayload.cartId);
    expect(getOrderBody.orderStatus).toBe('confirmed');
    expect(getOrderBody.paymentStatus).toBe('success');
  });

  // Test Case: API rejects add-to-cart request for out-of-stock product
  test('SCN-005: API rejects add-to-cart request for out-of-stock product', async ({ request }) => {
    const outOfStockProductId = 'product_out_of_stock_001';

    const addToCartPayload = {
      productId: outOfStockProductId,
      quantity: 1
    };

    // Step 1: Send POST request to /api/cart/add with zero-stock item
    const addToCartResponse = await request.post(`${BASE_URL}/api/cart/add`, {
      data: addToCartPayload
    });

    // Step 2: Inspect the HTTP response status code for error status
    expect([400, 409]).toContain(addToCartResponse.status());

    const addToCartBody = await addToCartResponse.json();
    expect(addToCartBody).toHaveProperty('message');
    expect(addToCartBody.message.toLowerCase()).toContain('out of stock');

    // Step 3: Send GET request to /api/cart to verify the product is not present
    const cartResponse = await request.get(`${BASE_URL}/api/cart`);
    expect(cartResponse.status()).toBe(200);

    const cartBody = await cartResponse.json();
    const items = cartBody.items || cartBody.products || [];
    const foundOutOfStockItem = items.find((item: any) => item.productId === outOfStockProductId);
    expect(foundOutOfStockItem).toBeUndefined();
  });

});
