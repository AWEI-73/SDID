import React from 'react';
import { render, screen } from '@testing-library/react';
import { SharedRoute } from '../shared-route';

describe('SharedRoute', () => {
    it('renders children correctly', () => {
        render(<SharedRoute><div data-testid="child">CHILD</div></SharedRoute>);
        expect(screen.getByTestId('child').textContent).toBe('CHILD');
    });
});
