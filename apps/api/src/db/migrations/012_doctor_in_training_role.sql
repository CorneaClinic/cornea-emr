-- Add doctor_in_training role (general doctor in training / assisting ophthalmologist).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin',
      'cornea_consultant',
      'ophthalmologist',
      'doctor_in_training',
      'optometrist',
      'technician',
      'receptionist'
    ));
