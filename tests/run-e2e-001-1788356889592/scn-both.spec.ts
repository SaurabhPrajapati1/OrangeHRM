import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3000/api';

test.describe('SCN', () => {

  // Test Case: Registration fails when email already exists
  test('SCN-001: Registration fails when email already exists', async ({ page, request }) => {
    const existingEmail = 'existing.user@example.com';
    const password = 'ValidPass123!';

    // Pre-condition: ensure the account exists via API (register once, ignore if already exists)
    await request.post(`${API_URL}/register`, {
      data: { email: existingEmail, password, name: 'Existing User' },
      failOnStatusCode: false,
    });

    // Step 1 & 2: Attempt to register again with the same email via API
    const apiResponse = await request.post(`${API_URL}/register`, {
      data: { email: existingEmail, password, name: 'Duplicate User' },
      failOnStatusCode: false,
    });

    expect(apiResponse.status()).toBe(409);
    const apiBody = await apiResponse.json();
    expect(apiBody.message || apiBody.error).toMatch(/email already in use/i);

    // Step 3: Verify no duplicate account is created via UI registration flow
    await page.goto(`${BASE_URL}/register`);

    const emailInput = page.getByTestId('register-email-input').or(page.getByRole('textbox', { name: /email/i }));
    const passwordInput = page.getByTestId('register-password-input').or(page.getByLabel(/password/i));
    const submitButton = page.getByTestId('register-submit-button').or(page.getByRole('button', { name: /register|sign up/i }));

    await emailInput.fill(existingEmail);
    await passwordInput.fill(password);
    await submitButton.click();

    const errorMessage = page.getByTestId('register-error-message').or(page.getByRole('alert'));
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/email already in use/i);

    // Verify only one account exists for that email via admin/lookup API
    const lookupResponse = await request.get(`${API_URL}/users?email=${encodeURIComponent(existingEmail)}`, {
      failOnStatusCode: false,
    });
    if (lookupResponse.ok()) {
      const users = await lookupResponse.json();
      const matchingUsers = Array.isArray(users) ? users.filter((u: any) => u.email === existingEmail) : [];
      expect(matchingUsers.length).toBe(1);
    }
  });

  // Test Case: Account lockout or rate limiting after multiple failed login attempts
  test('SCN-002: Account lockout or rate limiting after multiple failed login attempts', async ({ page, request }) => {
    const email = 'lockout.test@example.com';
    const wrongPassword = 'WrongPass000!';
    const correctPassword = 'CorrectPass123!';
    const maxAttempts = 5;

    // Ensure test account exists
    await request.post(`${API_URL}/register`, {
      data: { email, password: correctPassword, name: 'Lockout Test User' },
      failOnStatusCode: false,
    });

    await page.goto(`${BASE_URL}/login`);

    const emailInput = page.getByTestId('login-email-input').or(page.getByRole('textbox', { name: /email/i }));
    const passwordInput = page.getByTestId('login-password-input').or(page.getByLabel(/password/i));
    const loginButton = page.getByTestId('login-submit-button').or(page.getByRole('button', { name: /log ?in|sign in/i }));
    const errorMessage = page.getByTestId('login-error-message').or(page.getByRole('alert'));

    // Step 1: Attempt login with incorrect password multiple times
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await emailInput.fill(email);
      await passwordInput.fill(wrongPassword);
      await loginButton.click();

      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/invalid credentials|incorrect password/i);
    }

    // Step 2: Attempt login with correct credentials immediately after threshold reached
    await emailInput.fill(email);
    await passwordInput.fill(correctPassword);
    await loginButton.click();

    const lockoutMessage = page.getByTestId('account-lockout-message')
      .or(page.getByTestId('rate-limit-message'))
      .or(page.getByText(/account.*locked|too many attempts|rate limit|captcha/i));

    await expect(lockoutMessage).toBeVisible();

    // API-level verification of lockout/rate-limit response
    const apiLoginResponse = await request.post(`${API_URL}/login`, {
      data: { email, password: correctPassword },
      failOnStatusCode: false,
    });

    expect([403, 423, 429]).toContain(apiLoginResponse.status());
  });

  // Test Case: Checkout fails gracefully with declined test payment card
  test('SCN-004: Checkout fails gracefully with declined test payment card', async ({ page, request }) => {
    const declineCardNumber = '4000000000000002'; // sandbox decline test card
    const shippingDetails = {
      fullName: 'John Doe',
      address: '123 Test Street',
      city: 'Testville',
      postalCode: '12345',
      country: 'US',
    };

    await page.goto(`${BASE_URL}/cart`);

    // Ensure at least one item exists in cart before proceeding to checkout
    const checkoutButton = page.getByTestId('proceed-to-checkout-button').or(page.getByRole('button', { name: /checkout/i }));
    await expect(checkoutButton).toBeVisible();
    await checkoutButton.click();

    // Step 1: Enter valid shipping details
    await page.getByTestId('shipping-fullname-input').or(page.getByLabel(/full name/i)).fill(shippingDetails.fullName);
    await page.getByTestId('shipping-address-input').or(page.getByLabel(/address/i)).fill(shippingDetails.address);
    await page.getByTestId('shipping-city-input').or(page.getByLabel(/city/i)).fill(shippingDetails.city);
    await page.getByTestId('shipping-postalcode-input').or(page.getByLabel(/postal code|zip/i)).fill(shippingDetails.postalCode);

    const continueToPaymentButton = page.getByTestId('continue-to-payment-button').or(page.getByRole('button', { name: /continue|next/i }));
    await continueToPaymentButton.click();

    const shippingStepConfirmation = page.getByTestId('shipping-step-complete').or(page.getByText(/shipping.*saved|shipping.*confirmed/i));
    await expect(shippingStepConfirmation).toBeVisible();

    // Step 2: Enter sandbox decline test card
    const cardNumberInput = page.getByTestId('payment-card-number-input').or(page.getByLabel(/card number/i));
    const cardExpiryInput = page.getByTestId('payment-card-expiry-input').or(page.getByLabel(/expiry/i));
    const cardCvcInput = page.getByTestId('payment-card-cvc-input').or(page.getByLabel(/cvc|cvv/i));

    await cardNumberInput.fill(declineCardNumber);
    await cardExpiryInput.fill('12/30');
    await cardCvcInput.fill('123');

    // Step 3: Click Place Order
    const placeOrderButton = page.getByTestId('place-order-button').or(page.getByRole('button', { name: /place order/i }));
    await placeOrderButton.click();

    const paymentErrorMessage = page.getByTestId('payment-error-message').or(page.getByRole('alert'));
    await expect(paymentErrorMessage).toBeVisible();
    await expect(paymentErrorMessage).toContainText(/payment declined|try another card/i);

    // Step 4: Verify order status via API - no confirmed order created
    const ordersResponse = await request.get(`${API_URL}/orders?status=confirmed`, { failOnStatusCode: false });
    if (ordersResponse.ok()) {
      const orders = await ordersResponse.json();
      const declinedOrderExists = Array.isArray(orders) && orders.some((o: any) => o.paymentCardLast4 === declineCardNumber.slice(-4) && o.status === 'confirmed');
      expect(declinedOrderExists).toBeFalsy();
    }

    // Verify cart items remain unchanged
    await page.goto(`${BASE_URL}/cart`);
    const cartItems = page.getByTestId('cart-item');
    await expect(cartItems.first()).toBeVisible();
  });

  // Test Case: Product becomes out-of-stock while already in cart during checkout
  test('SCN-005: Product becomes out-of-stock while already in cart during checkout', async ({ page, request }) => {
    const productId = 'test-product-001';

    // Step 1: Add an in-stock product to the cart via UI
    await page.goto(`${BASE_URL}/products/${productId}`);

    const addToCartButton = page.getByTestId('add-to-cart-button').or(page.getByRole('button', { name: /add to cart/i }));
    await expect(addToCartButton).toBeEnabled();
    await addToCartButton.click();

    const cartConfirmation = page.getByTestId('add-to-cart-confirmation').or(page.getByText(/added to cart/i));
    await expect(cartConfirmation).toBeVisible();

    // Step 2: Simulate stock depletion via admin API
    const stockUpdateResponse = await request.patch(`${API_URL}/admin/products/${productId}/stock`, {
      data: { quantity: 0 },
      failOnStatusCode: false,
    });
    expect(stockUpdateResponse.ok()).toBeTruthy();

    const verifyStockResponse = await request.get(`${API_URL}/products/${productId}`, { failOnStatusCode: false });
    const productData = await verifyStockResponse.json();
    expect(productData.stock).toBe(0);

    // Step 3: Proceed to checkout with the out-of-stock item in cart
    await page.goto(`${BASE_URL}/cart`);

    const checkoutButton = page.getByTestId('proceed-to-checkout-button').or(page.getByRole('button', { name: /checkout/i }));
    await checkoutButton.click();

    const outOfStockWarning = page.getByTestId('out-of-stock-warning').or(page.getByText(/out of stock|no longer available/i));
    await expect(outOfStockWarning).toBeVisible();

    const placeOrderButton = page.getByTestId('place-order-button').or(page.getByRole('button', { name: /place order/i }));
    await expect(placeOrderButton).toBeDisabled();

    // Step 4: Verify order/cart state - order not placed, item flagged for removal/update
    const removeItemButton = page.getByTestId(`remove-item-${productId}`).or(page.getByRole('button', { name: /remove/i }));
    await expect(removeItemButton).toBeVisible();

    const ordersApiResponse = await request.get(`${API_URL}/orders?status=confirmed`, { failOnStatusCode: false });
    if (ordersApiResponse.ok()) {
      const orders = await ordersApiResponse.json();
      const orderCreatedForOOSItem = Array.isArray(orders) && orders.some((o: any) =>
        o.items?.some((item: any) => item.productId === productId) && o.status === 'confirmed'
      );
      expect(orderCreatedForOOSItem).toBeFalsy();
    }
  });

});
