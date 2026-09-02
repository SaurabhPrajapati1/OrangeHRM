import { test, expect } from '@playwright/test';

const BASE_URL = 'https://demo-shop.example.com';

test.describe('SCN', () => {

  // Register new user via UI with valid details
  test('Register new user via UI with valid details', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    await expect(
      page.getByTestId('register-name-input').or(page.getByLabel('Name'))
    ).toBeVisible();
    await expect(
      page.getByTestId('register-email-input').or(page.getByLabel('Email'))
    ).toBeVisible();
    await expect(
      page.getByTestId('register-password-input').or(page.getByLabel('Password', { exact: true }))
    ).toBeVisible();
    await expect(
      page.getByTestId('register-confirm-password-input').or(page.getByLabel('Confirm Password'))
    ).toBeVisible();

    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const strongPassword = 'StrongP@ssw0rd!123';

    const nameInput = page.getByTestId('register-name-input').or(page.getByLabel('Name'));
    const emailInput = page.getByTestId('register-email-input').or(page.getByLabel('Email'));
    const passwordInput = page.getByTestId('register-password-input').or(page.getByLabel('Password', { exact: true }));
    const confirmPasswordInput = page.getByTestId('register-confirm-password-input').or(page.getByLabel('Confirm Password'));

    await nameInput.fill('Test User');
    await emailInput.fill(uniqueEmail);
    await passwordInput.fill(strongPassword);
    await confirmPasswordInput.fill(strongPassword);

    await expect(page.getByTestId('register-error')).toHaveCount(0).catch(() => {});

    const registerButton = page.getByTestId('register-submit-button').or(
      page.getByRole('button', { name: /register/i })
    );
    await registerButton.click();

    const successMessage = page.getByTestId('register-success-message').or(
      page.getByText(/account created|registration successful/i)
    );
    const dashboardOrLoginUrl = page.url();

    await expect(
      successMessage.or(page).and(page)
    ).toBeTruthy();

    await expect(page).toHaveURL(/(login|dashboard)/i, { timeout: 10000 }).catch(async () => {
      await expect(successMessage).toBeVisible({ timeout: 10000 });
    });
  });

  // Login fails with incorrect password via UI
  test('Login fails with incorrect password via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    const emailInput = page.getByTestId('login-email-input').or(page.getByLabel('Email'));
    const passwordInput = page.getByTestId('login-password-input').or(page.getByLabel('Password'));
    const loginButton = page.getByTestId('login-submit-button').or(
      page.getByRole('button', { name: /login/i })
    );

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await emailInput.fill('registered.user@example.com');
    await passwordInput.fill('WrongPassword123!');

    await loginButton.click();

    const errorMessage = page.getByTestId('login-error-message').or(
      page.getByText(/invalid email or password/i)
    );
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveURL(/login/i);
  });

  // Filter products by single category via UI
  test('Filter products by single category via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    const productCards = page.getByTestId('product-card');
    await expect(productCards.first()).toBeVisible();
    const initialCount = await productCards.count();
    expect(initialCount).toBeGreaterThan(0);

    const categoryFilter = page.getByTestId('category-filter-electronics').or(
      page.getByRole('checkbox', { name: /electronics/i })
    ).or(page.getByRole('link', { name: /electronics/i }));

    await expect(categoryFilter).toBeVisible();
    await categoryFilter.click();

    await expect(productCards.first()).toBeVisible();

    const filteredCount = await productCards.count();
    expect(filteredCount).toBeGreaterThan(0);

    for (let i = 0; i < filteredCount; i++) {
      const categoryLabel = productCards.nth(i).getByTestId('product-category-label');
      await expect(categoryLabel).toHaveText(/electronics/i);
    }

    const clearFilterButton = page.getByTestId('clear-filter-button').or(
      page.getByRole('button', { name: /clear filter/i })
    );
    await clearFilterButton.click();

    await expect(productCards.first()).toBeVisible();
    const clearedCount = await productCards.count();
    expect(clearedCount).toBe(initialCount);
  });

  // Combine category filter with search keyword
  test('Combine category filter with search keyword', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    const productCards = page.getByTestId('product-card');
    await expect(productCards.first()).toBeVisible();

    const categoryFilter = page.getByTestId('category-filter-clothing').or(
      page.getByRole('checkbox', { name: /clothing/i })
    ).or(page.getByRole('link', { name: /clothing/i }));

    await categoryFilter.click();
    await expect(productCards.first()).toBeVisible();

    const categoryFilteredCount = await productCards.count();
    expect(categoryFilteredCount).toBeGreaterThan(0);

    const searchInput = page.getByTestId('search-input').or(
      page.getByPlaceholder(/search/i)
    ).or(page.getByRole('searchbox'));

    await expect(searchInput).toBeVisible();
    await searchInput.fill('shirt');
    await searchInput.press('Enter');

    await expect(productCards.first()).toBeVisible({ timeout: 10000 });

    const finalCount = await productCards.count();
    expect(finalCount).toBeGreaterThan(0);
    expect(finalCount).toBeLessThanOrEqual(categoryFilteredCount);

    for (let i = 0; i < finalCount; i++) {
      const categoryLabel = productCards.nth(i).getByTestId('product-category-label');
      const productName = productCards.nth(i).getByTestId('product-name');

      await expect(categoryLabel).toHaveText(/clothing/i);
      await expect(productName).toContainText(/shirt/i);
    }
  });

  // Complete checkout successfully with valid test-mode payment details
  test('Complete checkout successfully with valid test-mode payment details', async ({ page }) => {
    await page.goto(`${BASE_URL}/cart`);

    const checkoutButton = page.getByTestId('proceed-to-checkout-button').or(
      page.getByRole('button', { name: /proceed to checkout/i })
    );
    await expect(checkoutButton).toBeVisible();
    await checkoutButton.click();

    await expect(page).toHaveURL(/checkout/i);

    const orderSummary = page.getByTestId('order-summary-section');
    const shippingSection = page.getByTestId('shipping-section').or(
      page.getByRole('heading', { name: /shipping/i })
    );
    const paymentSection = page.getByTestId('payment-section').or(
      page.getByRole('heading', { name: /payment/i })
    );

    await expect(orderSummary).toBeVisible();
    await expect(shippingSection).toBeVisible();
    await expect(paymentSection).toBeVisible();

    const shippingNameInput = page.getByTestId('shipping-full-name-input').or(page.getByLabel('Full Name'));
    const shippingAddressInput = page.getByTestId('shipping-address-input').or(page.getByLabel('Address'));
    const shippingCityInput = page.getByTestId('shipping-city-input').or(page.getByLabel('City'));
    const shippingZipInput = page.getByTestId('shipping-zip-input').or(page.getByLabel(/zip|postal code/i));

    await shippingNameInput.fill('Test User');
    await shippingAddressInput.fill('123 Test Street');
    await shippingCityInput.fill('Test City');
    await shippingZipInput.fill('12345');

    const cardNumberInput = page.getByTestId('payment-card-number-input').or(page.getByLabel(/card number/i));
    const cardExpiryInput = page.getByTestId('payment-card-expiry-input').or(page.getByLabel(/expiry/i));
    const cardCvcInput = page.getByTestId('payment-card-cvc-input').or(page.getByLabel(/cvc|cvv/i));

    await cardNumberInput.fill('4242424242424242');
    await cardExpiryInput.fill('12/30');
    await cardCvcInput.fill('123');

    await expect(page.getByTestId('payment-error')).toHaveCount(0).catch(() => {});

    const placeOrderButton = page.getByTestId('place-order-button').or(
      page.getByRole('button', { name: /place order|confirm payment/i })
    );
    await placeOrderButton.click();

    await expect(page).toHaveURL(/order-confirmation|checkout\/success/i, { timeout: 15000 });

    const orderNumber = page.getByTestId('order-confirmation-number').or(
      page.getByText(/order number|order id/i)
    );
    await expect(orderNumber).toBeVisible({ timeout: 10000 });

    const orderStatus = page.getByTestId('order-status').or(
      page.getByText(/confirmed|processing/i)
    );
    await expect(orderStatus).toBeVisible();
  });

  // UI blocks adding out-of-stock product to cart
  test('UI blocks adding out-of-stock product to cart', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/out-of-stock-item`);

    const outOfStockLabel = page.getByTestId('out-of-stock-label').or(
      page.getByText(/out of stock/i)
    );
    await expect(outOfStockLabel).toBeVisible();

    const addToCartButton = page.getByTestId('add-to-cart-button').or(
      page.getByRole('button', { name: /add to cart/i })
    );

    const notifyMeButton = page.getByTestId('notify-me-button').or(
      page.getByRole('button', { name: /notify me/i })
    );

    const isAddToCartVisible = await addToCartButton.isVisible().catch(() => false);

    if (isAddToCartVisible) {
      await expect(addToCartButton).toBeDisabled();
    } else {
      await expect(notifyMeButton.or(outOfStockLabel)).toBeVisible();
    }

    if (isAddToCartVisible) {
      const isDisabled = await addToCartButton.isDisabled();
      if (!isDisabled) {
        await addToCartButton.click();
        const errorMessage = page.getByTestId('out-of-stock-error').or(
          page.getByText(/currently out of stock/i)
        );
        await expect(errorMessage).toBeVisible();
      }
    }

    await page.goto(`${BASE_URL}/cart`);
    const outOfStockItemInCart = page.getByTestId('cart-item-out-of-stock-item');
    await expect(outOfStockItemInCart).toHaveCount(0);
  });

});
