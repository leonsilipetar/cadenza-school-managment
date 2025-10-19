# Custom Attributes Guide

## Overview
As of October 2024, Cadenza has been genericized to be **portfolio-ready** and work for any music school, not just one specific institution. School-specific fields have been replaced with a flexible `customAttributes` JSON field.

## What Changed?

### Removed
- `maiZbor` (BOOLEAN) - School-specific choir field

### Added
- `customAttributes` (JSONB) - Flexible JSON object for ANY school-specific data

## How to Use Custom Attributes

### For Schools
Each school can now store their own custom data in the `customAttributes` field:

```javascript
// Example 1: School with choir programs
{
  customAttributes: {
    choir: true,
    choirLevel: 'advanced',
    ensembleType: 'jazz'
  }
}

// Example 2: School with competition programs
{
  customAttributes: {
    competitionTrack: true,
    competitionLevel: 'regional',
    specialProgram: 'masterclass'
  }
}

// Example 3: School with orchestra programs
{
  customAttributes: {
    orchestra: true,
    instrument: 'violin',
    orchestraSection: 'strings'
  }
}
```

### In the API

#### Creating a User
```javascript
POST /api/signup
{
  "ime": "John",
  "prezime": "Doe",
  "customAttributes": {
    "choir": true,
    "specialProgram": "summer-intensive"
  }
}
```

#### Updating Custom Attributes
```javascript
PUT /api/users/:id
{
  "customAttributes": {
    "choir": false,
    "orchestra": true,
    "instrument": "cello"
  }
}
```

#### Querying by Custom Attributes
```javascript
// Find all users in choir
const users = await User.findAll({
  where: {
    customAttributes: {
      choir: true
    }
  }
});

// PostgreSQL JSONB query
const users = await sequelize.query(
  `SELECT * FROM "User" WHERE "customAttributes"->>'choir' = 'true'`
);
```

### In the Frontend

The signup form has been updated to remove the school-specific checkbox. If you want to add custom fields for your school:

1. **Option A: Update the signup form** to include your school's specific fields
2. **Option B: Handle in admin panel** - Let admins set custom attributes after signup
3. **Option C: School settings** - Define available custom attributes per school in settings

## Benefits

✅ **Flexible** - Each school can define their own attributes  
✅ **Scalable** - No database migrations needed for new school-specific fields  
✅ **Portfolio-ready** - Generic system works for any music school  
✅ **Type-safe** - PostgreSQL JSONB provides validation and indexing  

## Migration

The migration `20251020000000-replace-maiZbor-with-customAttributes.js` has:
- ✅ Removed `maiZbor` from `User` table
- ✅ Removed `maiZbor` from `PendingUsers` table  
- ✅ Added `customAttributes` to both tables with default `{}`

## Example Use Cases

### School Admin Dashboard
```jsx
// Display custom attributes dynamically
{Object.entries(user.customAttributes || {}).map(([key, value]) => (
  <div key={key}>
    <strong>{key}:</strong> {value.toString()}
  </div>
))}
```

### Filtering Students
```jsx
// Filter students by custom attribute
const choirStudents = students.filter(s => 
  s.customAttributes?.choir === true
);
```

### Reports
```sql
-- Count students by custom programs
SELECT 
  customAttributes->>'choir' as has_choir,
  COUNT(*) 
FROM "User" 
WHERE isStudent = true 
GROUP BY customAttributes->>'choir';
```

## Notes for Developers

- `customAttributes` is a JSONB column (not regular JSON)
- Default value is `{}` (empty object)
- Can store any valid JSON structure
- Indexed for fast queries
- Can use PostgreSQL JSONB operators (`->`, `->>`, `@>`, etc.)

## Future Enhancements

Consider adding:
1. **School Settings** - Define allowed custom attributes per school
2. **Validation** - Schema validation for custom attributes
3. **UI Builder** - Admin interface to build custom signup forms
4. **Templates** - Pre-defined custom attribute templates for common school types

