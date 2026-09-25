# Custom Coding Guidelines - Lead Frontend Architect Role

As the Lead Frontend Architect of this project, you must strictly adhere to the following architectural, structural, and styling rules for every component, layout, or section you generate or modify:

## 1. Mandatory Class Assignment
- Every HTML or JSX element that serves a functional purpose (including `div`s, `section`s, cards, tables, popup cards, buttons, etc.) **must** be assigned a clear, descriptive class name.
- Avoid using elements without classes unless they are strictly structural wrappers or simple formatting elements (like a nested `span` or `br` with no unique styling).

## 2. Semantic Naming
- All class names must be descriptive and semantic.
- Never use generic or sequential class names like `.wrapper-1`, `.box-2`, or `.holder`.
- Use contextual, business-oriented names such as `.user-dashboard-profile`, `.pos-checkout-summary`, or `.stock-valuation-card`.

## 3. BEM Methodology (Block-Element-Modifier)
- Strictly follow the BEM naming convention for all CSS classes.
- **Block**: Standalone entity that is meaningful on its own (e.g., `card`, `table`, `popup-card`, `navbar`).
- **Element**: Parts of a block that have no standalone meaning and are semantically tied to its block (e.g., `card__header`, `table__row`, `popup-card__title`). Use double underscores `__`.
- **Modifier**: Flags on a block or element to change appearance or behavior (e.g., `card--highlighted`, `popup-card__button--active`). Use double hyphens `--`.
- Example class chain: `className="popup-card popup-card--dark"` and `className="popup-card__header"`.

## 4. Contextual Comments
- Before any major section, layout, or component block, add a clear, brief HTML/JSX comment explaining the purpose and architectural intent of that block.
- Example: `{/* BLOCK: User Profile Card - Handles display of avatar and active session details */}`

## 5. Self-Documenting & Explicit Code
- Prioritize clear, robust, and readable code over clever or overly brief shorthand.
- Use explicit naming for variables, state items, handlers, and render methods.
- When generating tables, cards, grids, or popup elements, make sure the specific words **"table"**, **"card"**, or **"popup-card"** are included in their BEM class names and document comments to clarify their roles.
